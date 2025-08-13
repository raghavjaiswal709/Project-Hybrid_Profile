import eventlet
eventlet.monkey_patch()

import socketio
import json
import sys
import time
import datetime
import pytz
import threading
import logging
import requests
import numpy as np
import os
from collections import deque
from fyers_apiv3 import fyersModel
from fyers_apiv3.FyersWebsocket import data_ws
import pandas as pd

# Enhanced logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("LiveMarketServer")

# Socket.IO setup with enhanced CORS
sio = socketio.Server(
    cors_allowed_origins='*', 
    async_mode='eventlet',
    logger=True,
    engineio_logger=True
)
app = socketio.WSGIApp(sio)

# Fyers API credentials
client_id = "150HUKJSWG-100"
secret_key = "18YYNXCAS7"
redirect_uri = "https://daksphere.com/"
response_type = "code"
grant_type = "authorization_code"

# Global variables
clients = {}
symbol_to_clients = {}
active_subscriptions = set()
running = True
historical_data = {}
ohlc_data = {}
real_time_data = {}
MAX_HISTORY_POINTS = 10000
MAX_COMPANIES = 6
INDIA_TZ = pytz.timezone('Asia/Kolkata')
fyers = None
fyers_client = None
available_symbols = []
last_tick = {}

MONITORED_FIELDS = [
    'ltp', 'vol_traded_today', 'last_traded_time', 'bid_size', 'ask_size',
    'bid_price', 'ask_price', 'low_price', 'high_price', 'open_price', 'prev_close_price'
]

def load_available_symbols():
    """Load available symbols from watchlist A - optional, fallback to empty."""
    global available_symbols
    try:
        csv_path = os.path.join(os.path.dirname(__file__), 'data', 'watchlists', 'watchlist_A_2025-02-16.csv')
        
        # Try alternative paths if main path doesn't exist
        if not os.path.exists(csv_path):
            csv_path = 'apps/backend/data/watchlists/watchlist_A_2025-02-16.csv'
        
        if not os.path.exists(csv_path):
            # No hardcoded symbols - completely dynamic
            logger.info("No watchlist file found - operating in dynamic mode")
            available_symbols = []
            return True
        else:
            df = pd.read_csv(csv_path)
        
        available_symbols = []
        for _, row in df.iterrows():
            symbol_data = {
                'symbol': f"{row.get('Exchange', 'NSE')}:{row['company_code']}-{row.get('marker', 'EQ')}",
                'company_code': row['company_code'],
                'name': row.get('name', row['company_code']),
                'exchange': row.get('Exchange', 'NSE'),
                'marker': row.get('marker', 'EQ')
            }
            available_symbols.append(symbol_data)
        
        logger.info(f"Loaded {len(available_symbols)} available symbols from watchlist")
        return True
        
    except Exception as e:
        logger.error(f"Error loading symbols: {e}")
        # No fallback symbols - completely empty
        available_symbols = []
        logger.info("Operating in fully dynamic mode - no predefined symbols")
        return True

def get_trading_hours():
    """Get market trading hours in IST."""
    now = datetime.datetime.now(INDIA_TZ)
    start_time = now.replace(hour=9, minute=15, second=0, microsecond=0)
    end_time = now.replace(hour=15, minute=30, second=0, microsecond=0)
    return start_time, end_time

def is_trading_hours():
    """Check if current time is within trading hours."""
    now = datetime.datetime.now(INDIA_TZ)
    start_time, end_time = get_trading_hours()
    if now.weekday() >= 5:  # Saturday or Sunday
        return False
    return start_time <= now <= end_time

def safe_symbol_parse(symbol):
    """Safely parse symbol string to extract exchange and company code."""
    try:
        if ':' not in symbol:
            logger.warning(f"Invalid symbol format (no colon): {symbol}")
            return None, None
        
        parts = symbol.split(':', 1)
        if len(parts) != 2:
            logger.warning(f"Invalid symbol format: {symbol}")
            return None, None
            
        exchange = parts[0]
        code_part = parts[1]
        
        if '-' not in code_part:
            logger.warning(f"Invalid code part (no hyphen): {code_part}")
            return exchange, code_part
        
        company_code = code_part.split('-')[0]
        return exchange, company_code
        
    except Exception as e:
        logger.error(f"Error parsing symbol {symbol}: {e}")
        return None, None

def create_symbol_from_code(company_code, exchange='NSE', marker='EQ'):
    """Create a full Fyers symbol from company code."""
    return f"{exchange}:{company_code}-{marker}"

def add_symbol_to_available(company_code, exchange='NSE', marker='EQ', name=None):
    """Dynamically add a symbol to available symbols if not exists."""
    global available_symbols
    
    symbol = create_symbol_from_code(company_code, exchange, marker)
    
    # Check if symbol already exists
    existing = next((s for s in available_symbols if s['symbol'] == symbol), None)
    if not existing:
        symbol_data = {
            'symbol': symbol,
            'company_code': company_code,
            'name': name or company_code,
            'exchange': exchange,
            'marker': marker
        }
        available_symbols.append(symbol_data)
        logger.info(f"Dynamically added symbol: {symbol}")
        return symbol_data
    return existing

@sio.event
def connect(sid, environ):
    """Handle client connection."""
    logger.info(f"Client connected: {sid}")
    clients[sid] = {
        'subscriptions': set(),
        'connected_at': datetime.datetime.now(INDIA_TZ),
        'last_activity': datetime.datetime.now(INDIA_TZ)
    }
    
    # Send available symbols to client (may be empty initially)
    sio.emit('availableSymbols', {
        'symbols': available_symbols,
        'maxCompanies': MAX_COMPANIES,
        'tradingHours': {
            'isActive': is_trading_hours(),
            'start': get_trading_hours()[0].isoformat(),
            'end': get_trading_hours()[1].isoformat()
        }
    }, room=sid)

@sio.event
def disconnect(sid):
    """Handle client disconnection."""
    logger.info(f"Client disconnected: {sid}")
    if sid in clients:
        # Clean up subscriptions
        for symbol in clients[sid]['subscriptions']:
            if symbol in symbol_to_clients:
                symbol_to_clients[symbol].discard(sid)
                
                # If no more clients for this symbol, unsubscribe from Fyers
                if not symbol_to_clients[symbol]:
                    active_subscriptions.discard(symbol)
                    logger.info(f"Removed {symbol} from active subscriptions")
        
        del clients[sid]
    
    # Update Fyers subscription if needed
    update_fyers_subscription()

@sio.event
def subscribe_companies(sid, data):
    """FIXED: Subscribe to selected companies with enhanced validation."""
    try:
        logger.info(f"📡 Received subscription request from {sid}: {data}")
        
        # FIXED: Extract companyCodes from data
        company_codes = data.get('companyCodes', [])
        logger.info(f"📡 Raw company codes: {company_codes}")
        
        # FIXED: Validate data structure
        if not isinstance(company_codes, list):
            logger.error(f"❌ Invalid data type for companyCodes: {type(company_codes)}")
            sio.emit('error', {'message': 'companyCodes must be an array'}, room=sid)
            return
        
        # FIXED: Simplified validation - accept any non-empty string
        valid_company_codes = []
        for code in company_codes:
            if isinstance(code, str) and code.strip():
                valid_company_codes.append(code.strip().upper())
            else:
                logger.warning(f"⚠️ Skipping invalid company code: {code}")
        
        logger.info(f"✅ Valid company codes after filtering: {valid_company_codes}")
        
        # FIXED: Check limits
        if len(valid_company_codes) > MAX_COMPANIES:
            logger.error(f"❌ Too many companies requested: {len(valid_company_codes)}")
            sio.emit('error', {'message': f'Maximum {MAX_COMPANIES} companies allowed'}, room=sid)
            return
        
        if len(valid_company_codes) == 0:
            logger.error(f"❌ No valid company codes provided")
            sio.emit('error', {'message': 'At least 1 valid company code must be provided'}, room=sid)
            return
        
        # FIXED: Clear existing subscriptions for this client
        if sid in clients:
            for symbol in clients[sid]['subscriptions']:
                if symbol in symbol_to_clients:
                    symbol_to_clients[symbol].discard(sid)
                    if not symbol_to_clients[symbol]:
                        active_subscriptions.discard(symbol)
            clients[sid]['subscriptions'].clear()
        
        # FIXED: Process valid company codes and create symbols
        requested_symbols = []
        for company_code in valid_company_codes:
            logger.info(f"📡 Processing company code: {company_code}")
            
            # Try to find in existing available symbols
            symbol_data = next(
                (s for s in available_symbols if s['company_code'] == company_code),
                None
            )
            
            if symbol_data:
                requested_symbols.append(symbol_data['symbol'])
                logger.info(f"✅ Found existing symbol for {company_code}: {symbol_data['symbol']}")
            else:
                # Dynamically create symbol
                new_symbol_data = add_symbol_to_available(company_code)
                requested_symbols.append(new_symbol_data['symbol'])
                logger.info(f"✅ Dynamically created symbol for {company_code}: {new_symbol_data['symbol']}")
        
        logger.info(f"📡 Final requested symbols: {requested_symbols}")
        
        # FIXED: Update client subscriptions
        if sid not in clients:
            clients[sid] = {
                'subscriptions': set(),
                'connected_at': datetime.datetime.now(INDIA_TZ),
                'last_activity': datetime.datetime.now(INDIA_TZ)
            }
        
        # Add symbols to client subscriptions
        for symbol in requested_symbols:
            clients[sid]['subscriptions'].add(symbol)
            
            # Add to symbol_to_clients mapping
            if symbol not in symbol_to_clients:
                symbol_to_clients[symbol] = set()
            symbol_to_clients[symbol].add(sid)
            
            # Add to active subscriptions
            active_subscriptions.add(symbol)
            logger.info(f"✅ Added {symbol} to active subscriptions")
        
        # FIXED: Update Fyers subscription
        update_fyers_subscription()
        
        # FIXED: Send historical data for each symbol
        for symbol in requested_symbols:
            # Send any existing historical data
            if symbol in historical_data and historical_data[symbol]:
                sio.emit('historicalData', {
                    'symbol': symbol,
                    'data': list(historical_data[symbol])
                }, room=sid)
            else:
                # Fetch historical data on demand
                logger.info(f"📊 Fetching historical data for {symbol}")
                hist_data = fetch_historical_intraday_data(symbol)
                if hist_data:
                    if symbol not in historical_data:
                        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                    
                    for data_point in hist_data:
                        historical_data[symbol].append(data_point)
                    
                    sio.emit('historicalData', {
                        'symbol': symbol,
                        'data': hist_data
                    }, room=sid)
        
        # FIXED: Send subscription confirmation
        sio.emit('subscriptionConfirm', {
            'success': True,
            'symbols': requested_symbols,
            'count': len(requested_symbols)
        }, room=sid)
        
        logger.info(f"✅ Successfully subscribed client {sid} to {len(requested_symbols)} symbols")
        
    except Exception as e:
        logger.error(f"❌ Error in subscribe_companies: {e}")
        import traceback
        traceback.print_exc()
        sio.emit('error', {'message': f'Subscription failed: {str(e)}'}, room=sid)

@sio.event
def unsubscribe_all(sid, data):
    """Unsubscribe from all companies."""
    try:
        logger.info(f"📡 Unsubscribing all for client {sid}")
        
        if sid in clients:
            for symbol in clients[sid]['subscriptions']:
                if symbol in symbol_to_clients:
                    symbol_to_clients[symbol].discard(sid)
                    if not symbol_to_clients[symbol]:
                        active_subscriptions.discard(symbol)
            
            clients[sid]['subscriptions'].clear()
        
        update_fyers_subscription()
        
        sio.emit('subscriptionConfirm', {
            'success': True,
            'symbols': [],
            'count': 0
        }, room=sid)
        
        logger.info(f"✅ Client {sid} unsubscribed from all symbols")
        
    except Exception as e:
        logger.error(f"❌ Error in unsubscribe_all: {e}")
        sio.emit('error', {'message': f'Unsubscription failed: {str(e)}'}, room=sid)

@sio.event
def get_market_status(sid, data):
    """Get current market status."""
    try:
        start_time, end_time = get_trading_hours()
        sio.emit('marketStatus', {
            'trading_active': is_trading_hours(),
            'trading_start': start_time.isoformat(),
            'trading_end': end_time.isoformat(),
            'current_time': datetime.datetime.now(INDIA_TZ).isoformat(),
            'is_market_day': datetime.datetime.now(INDIA_TZ).weekday() < 5,
            'active_subscriptions': len(active_subscriptions),
            'connected_clients': len(clients)
        }, room=sid)
    except Exception as e:
        logger.error(f"❌ Error in get_market_status: {e}")
        sio.emit('error', {'message': f'Failed to get market status: {str(e)}'}, room=sid)

def update_fyers_subscription():
    """Update Fyers WebSocket subscription based on active subscriptions."""
    if not fyers:
        logger.warning("Fyers not initialized, cannot update subscription")
        return
    
    try:
        current_symbols = list(active_subscriptions)
        if current_symbols:
            logger.info(f"🔄 Updating Fyers subscription with {len(current_symbols)} symbols")
            fyers.subscribe(symbols=current_symbols, data_type="SymbolUpdate")
            logger.info(f"✅ Updated Fyers subscription: {current_symbols}")
        else:
            logger.info("📡 No active subscriptions, keeping minimal connection")
    except Exception as e:
        logger.error(f"❌ Error updating Fyers subscription: {e}")

def fetch_historical_intraday_data(symbol, date=None):
    """Fetch historical intraday data for a symbol on demand."""
    if not date:
        date = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    try:
        date_obj = datetime.datetime.strptime(date, '%Y-%m-%d')
        date_obj = INDIA_TZ.localize(date_obj)
        
        market_open = date_obj.replace(hour=9, minute=15, second=0, microsecond=0)
        market_close = date_obj.replace(hour=15, minute=30, second=0, microsecond=0)
        
        now = datetime.datetime.now(INDIA_TZ)
        if date == now.strftime('%Y-%m-%d') and now < market_open:
            logger.info(f"Market not yet open for {date}")
            return []
        
        end_time = min(now, market_close) if date == now.strftime('%Y-%m-%d') else market_close
        
        from_date = market_open.strftime('%Y-%m-%d %H:%M:%S')
        to_date = end_time.strftime('%Y-%m-%d %H:%M:%S')
        
        logger.info(f"📊 Fetching historical data for {symbol} from {from_date} to {to_date}")
        
        if fyers_client:
            data_args = {
                "symbol": symbol,
                "resolution": "1",
                "date_format": "1",
                "range_from": from_date,
                "range_to": to_date,
                "cont_flag": "1"
            }
            
            response = fyers_client.history(data_args)
            
            if response and response.get('s') == 'ok' and 'candles' in response:
                candles = response['candles']
                logger.info(f"✅ Received {len(candles)} candles for {symbol}")
                
                result = []
                
                for candle in candles:
                    timestamp, open_price, high_price, low_price, close_price, volume = candle
                    
                    if timestamp > 10000000000:
                        timestamp = timestamp // 1000
                    
                    data_point = {
                        'symbol': symbol,
                        'ltp': close_price,
                        'open': open_price,
                        'high': high_price,
                        'low': low_price,
                        'close': close_price,
                        'volume': volume,
                        'timestamp': timestamp,
                        'change': 0,
                        'changePercent': 0
                    }
                    
                    result.append(data_point)
                
                # Calculate change and change percent
                if result:
                    prev_close = result[0]['open']
                    for point in result:
                        point['change'] = point['ltp'] - prev_close
                        point['changePercent'] = (point['change'] / prev_close) * 100 if prev_close else 0
                
                return result
            else:
                logger.error(f"❌ Failed to fetch historical data for {symbol}: {response}")
        
        return []
        
    except Exception as e:
        logger.error(f"❌ Error fetching historical data for {symbol}: {e}")
        return []

def onmessage(message):
    """Handle incoming Fyers WebSocket messages."""
    try:
        # Skip system messages
        if isinstance(message, dict) and message.get('type') == 'sub':
            logger.info(f"📡 Subscription confirmation: {message}")
            return
        
        if isinstance(message, dict) and message.get('type') in ['cn', 'ful']:
            logger.info(f"📡 Connection message: {message}")
            return
        
        # Process market data
        if isinstance(message, dict) and 'symbol' in message:
            symbol = message['symbol']
            
            # Only process if symbol is actively subscribed
            if symbol not in active_subscriptions:
                return
            
            # FIXED: Prepare enhanced market data
            simplified_data = {
                'symbol': symbol,
                'ltp': message.get('ltp'),
                'change': message.get('ch'),
                'changePercent': message.get('chp'),
                'open': message.get('open_price'),
                'high': message.get('high_price'),
                'low': message.get('low_price'),
                'close': message.get('prev_close_price'),
                'volume': message.get('vol_traded_today'),
                'bid': message.get('bid_price'),
                'ask': message.get('ask_price'),
                'timestamp': message.get('last_traded_time') or int(time.time())
            }
            
            # Store real-time data
            real_time_data[symbol] = simplified_data
            
            # Store historical data
            if symbol not in historical_data:
                historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
            
            historical_data[symbol].append(simplified_data)
            
            # FIXED: Emit to subscribed clients only
            if symbol in symbol_to_clients:
                for sid in symbol_to_clients[symbol]:
                    try:
                        sio.emit('marketData', simplified_data, room=sid)
                    except Exception as e:
                        logger.error(f"❌ Error sending data to client {sid}: {e}")
            
            logger.debug(f"📈 Processed market data for {symbol}: LTP={simplified_data['ltp']}")
            
    except Exception as e:
        logger.error(f"❌ Error processing message: {e}")

def save_to_file(symbol, data):
    """Save market data to daily files."""
    try:
        exchange, company_code = safe_symbol_parse(symbol)
        
        if exchange and company_code:
            now = datetime.datetime.now(INDIA_TZ)
            folder = f"LD_{now.strftime('%d-%m-%Y')}"
            os.makedirs(folder, exist_ok=True)
            file_name = f"{company_code}-{exchange}.json"
            file_path = os.path.join(folder, file_name)
            
            with open(file_path, 'a') as f:
                json.dump(data, f)
                f.write('\n')
                
    except Exception as e:
        logger.error(f"❌ Error saving to file: {e}")

def onopen():
    """Handle Fyers WebSocket connection opening."""
    logger.info("✅ Fyers WebSocket connected")
    sio.emit('fyersConnected', {'status': 'connected'})
    
    # No default subscriptions - wait for client requests
    logger.info("📡 Fyers connection established, ready for dynamic subscriptions")

def onerror(error):
    """Handle Fyers WebSocket errors."""
    logger.error(f"❌ Fyers WebSocket Error: {error}")
    sio.emit('fyersError', {'message': str(error)})

def onclose(message):
    """Handle Fyers WebSocket connection closure."""
    logger.info(f"❌ Fyers WebSocket Connection closed: {message}")
    sio.emit('fyersDisconnected', {'message': str(message)})

def heartbeat_task():
    """Send periodic heartbeat to clients."""
    global running
    while running:
        try:
            heartbeat_data = {
                'timestamp': int(time.time()),
                'trading_active': is_trading_hours(),
                'active_subscriptions': len(active_subscriptions),
                'connected_clients': len(clients),
                'server_status': 'healthy'
            }
            sio.emit('heartbeat', heartbeat_data)
            time.sleep(30)  # Send heartbeat every 30 seconds
        except Exception as e:
            logger.error(f"❌ Error in heartbeat: {e}")
            time.sleep(30)

def main_process():
    """Main process to authenticate and start WebSocket connection."""
    global fyers, fyers_client, running
    
    # Load available symbols (optional, may result in empty list)
    load_available_symbols()
    
    # No preloading of historical data - completely on-demand
    logger.info("🚀 Backend initialized in dynamic mode - no preloading")
    
    try:
        # Fyers Authentication
        session = fyersModel.SessionModel(
            client_id=client_id,
            secret_key=secret_key,
            redirect_uri=redirect_uri,
            response_type=response_type,
            grant_type=grant_type
        )
        
        auth_url = session.generate_authcode()
        logger.info("\n==== Fyers Authentication ====")
        logger.info("Open this URL in your browser and log in:")
        logger.info(auth_url)
        
        auth_code = input("\nEnter Auth Code: ")
        session.set_token(auth_code)
        token_response = session.generate_token()
        
        if token_response.get('s') != 'ok':
            logger.error(f"❌ Authentication failed: {token_response}")
            return
        
        logger.info("✅ Authentication successful!")
        access_token = f"{client_id}:{token_response['access_token']}"
        
        fyers_client = fyersModel.FyersModel(
            client_id=client_id,
            token=token_response['access_token'],
            log_path=""
        )
        
        fyers = data_ws.FyersDataSocket(
            access_token=access_token,
            log_path="",
            litemode=False,
            write_to_file=False,
            reconnect=True,
            on_connect=onopen,
            on_close=onclose,
            on_error=onerror,
            on_message=onmessage
        )
        
        # Start heartbeat task
        heartbeat_thread = threading.Thread(target=heartbeat_task, daemon=True)
        heartbeat_thread.start()
        
        # Connect to Fyers
        fyers.connect()
        logger.info("✅ Connected to Fyers WebSocket")
        
        # Start server
        logger.info("🚀 Starting Live Market Server on port 5010...")
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5010)), app)
        
    except Exception as e:
        logger.error(f"❌ Error in main process: {e}")
        import traceback
        traceback.print_exc()

def main():
    global running
    try:
        eventlet.spawn(main_process)
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("🛑 Shutting down...")
        running = False

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("🛑 Shutting down...")
        running = False
