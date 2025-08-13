'use client';
import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { 
  ChevronRight, 
  TrendingUp,
  BarChart3,
  LineChart,
  CandlestickChart,
  ArrowLeftRight,
  ShoppingCart,
  TrendingDown
} from "lucide-react";
interface DataPoint {
  ltp: number;
  timestamp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  sma_20?: number;
  ema_9?: number;
  rsi_14?: number;
  bid?: number;
  ask?: number;
  buyVolume?: number;
  sellVolume?: number;
}
interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
}
interface PlotlyChartProps {
  symbol: string;
  data: DataPoint | null;
  historicalData: DataPoint[];
  ohlcData?: OHLCPoint[];
  tradingHours: {
    start: string;
    end: string;
    current: string;
    isActive: boolean;
  };
}
const PlotlyChart: React.FC<PlotlyChartProps> = ({ 
  symbol, 
  data, 
  historicalData,
  ohlcData = [],
  tradingHours,
}) => {
  const chartRef = useRef<any>(null);
  const spreadChartRef = useRef<any>(null);
  const bidAskChartRef = useRef<any>(null);
  const buySellVolumeChartRef = useRef<any>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [showIndicators, setShowIndicators] = useState<{
    sma20: boolean;
    ema9: boolean;
    rsi: boolean;
    macd: boolean;
    bb: boolean;
    vwap: boolean;
    bidAsk: boolean;
    bidAskSpread: boolean;
    buySellVolume: boolean;
  }>({
    sma20: false,
    ema9: false,
    rsi: false,
    macd: false,
    bb: false,
    vwap: false,
    bidAsk: true,
    bidAskSpread: true,
    buySellVolume: true
  });
  const [preservedAxisRanges, setPreservedAxisRanges] = useState<{
  xaxis?: [Date, Date];
  yaxis?: [number, number];
}>({});
  const calculateBuySellVolume = (dataPoint: DataPoint | OHLCPoint) => {
    let buyVolume = 0;
    let sellVolume = 0;
    const totalVolume = dataPoint.volume || 0;
    if ('buyVolume' in dataPoint && 'sellVolume' in dataPoint) {
      buyVolume = dataPoint.buyVolume || 0;
      sellVolume = dataPoint.sellVolume || 0;
    } else {
      let priceChange = 0;
      if ('open' in dataPoint && 'close' in dataPoint) {
        priceChange = (dataPoint.close - dataPoint.open) / dataPoint.open;
      } else if ('ltp' in dataPoint) {
        const currentIndex = historicalData.findIndex(p => p.timestamp === dataPoint.timestamp);
        if (currentIndex > 0) {
          const prevPrice = historicalData[currentIndex - 1].ltp;
          priceChange = (dataPoint.ltp - prevPrice) / prevPrice;
        }
      }
      const buyRatio = Math.max(0, Math.min(1, 0.5 + priceChange * 2));
      buyVolume = totalVolume * buyRatio;
      sellVolume = totalVolume * (1 - buyRatio);
    }
    return { buyVolume, sellVolume };
  };
  const prepareLineChartData = () => {
    const allData = [...historicalData];
    if (data && data.ltp) {
      const lastPoint = historicalData.length > 0 ? 
        historicalData[historicalData.length - 1] : null;
      if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
        allData.push(data);
      }
    }
    allData.sort((a, b) => a.timestamp - b.timestamp);
    const x = allData.map(point => new Date(point.timestamp * 1000));
    const y = allData.map(point => point.ltp);
    const bid = allData.map(point => point.bid || null);
    const ask = allData.map(point => point.ask || null);
    const spread = allData.map(point => {
      if (point.ask && point.bid) {
        return point.ask - point.bid;
      }
      return null;
    });
    const sma20 = allData.map(point => point.sma_20 || null);
    const ema9 = allData.map(point => point.ema_9 || null);
    const rsi = allData.map(point => point.rsi_14 || null);
    const buyVolumes = allData.map(point => calculateBuySellVolume(point).buyVolume);
    const sellVolumes = allData.map(point => calculateBuySellVolume(point).sellVolume);
    return { x, y, allData, sma20, ema9, rsi, bid, ask, spread, buyVolumes, sellVolumes };
  };
const calculateStandardDeviation = (values: number[], usePopulation = false) => {
  if (values.length === 0) return 0;
  const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
  const sumOfSquaredDifferences = values.reduce((acc, val) => acc + (val - mean) ** 2, 0);
  return Math.sqrt(sumOfSquaredDifferences / (values.length - (usePopulation ? 0 : 1)));
};
const calculateVolumeStandardDeviation = (dataPoint: DataPoint | OHLCPoint, index: number) => {
  const windowSize = 20;
  let volumes: number[] = [];
  if (chartType === 'line') {
    const startIndex = Math.max(0, index - windowSize + 1);
    volumes = historicalData.slice(startIndex, index + 1)
      .map(point => point.volume || 0)
      .filter(vol => vol > 0);
  } else {
    const startIndex = Math.max(0, index - windowSize + 1);
    volumes = ohlcData.slice(startIndex, index + 1)
      .map(candle => candle.volume || 0)
      .filter(vol => vol > 0);
  }
  return volumes.length > 1 ? calculateStandardDeviation(volumes) : 0;
};
const calculateSMA = (prices: number[], period: number) => {
  if (prices.length < period) return [];
  const smaValues = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
    smaValues.push(sum / period);
  }
  return smaValues;
};
const calculateEMA = (prices: number[], period: number) => {
  if (prices.length < period) return [];
  const multiplier = 2 / (period + 1);
  const emaValues = [];
  const firstSMA = prices.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
  emaValues.push(firstSMA);
  for (let i = period; i < prices.length; i++) {
    const ema = (prices[i] * multiplier) + (emaValues[emaValues.length - 1] * (1 - multiplier));
    emaValues.push(ema);
  }
  return emaValues;
};
const calculateRSI = (prices: number[], period: number) => {
  if (prices.length < period + 1) return [];
  const gains = [];
  const losses = [];
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  const rsiValues = [];
  for (let i = period - 1; i < gains.length; i++) {
    const avgGain = gains.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0) / period;
    const avgLoss = losses.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0) / period;
    if (avgLoss === 0) {
      rsiValues.push(100);
    } else {
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push(rsi);
    }
  }
  return rsiValues;
};
const calculateBollingerBands = (prices: number[], period: number, stdDev: number) => {
  if (prices.length < period) return null;
  const smaValues = calculateSMA(prices, period);
  const upper = [];
  const middle = [];
  const lower = [];
  for (let i = 0; i < smaValues.length; i++) {
    const startIndex = i + period - 1;
    const slice = prices.slice(startIndex - period + 1, startIndex + 1);
    const std = calculateStandardDeviation(slice);
    middle.push(smaValues[i]);
    upper.push(smaValues[i] + (std * stdDev));
    lower.push(smaValues[i] - (std * stdDev));
  }
  return { upper, middle, lower };
};
const calculateMACD = (prices: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number) => {
  if (prices.length < slowPeriod) return null;
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  if (fastEMA.length === 0 || slowEMA.length === 0) return null;
  const macdLine = [];
  const startIndex = slowPeriod - fastPeriod;
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + startIndex] - slowEMA[i]);
  }
  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = [];
  for (let i = signalPeriod - 1; i < macdLine.length; i++) {
    histogram.push(macdLine[i] - signalLine[i - signalPeriod + 1]);
  }
  return { macdLine, signalLine, histogram };
};
const calculateVWAP = (close: number[], high: number[], low: number[], volume: number[]) => {
  const vwapValues = [];
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  for (let i = 0; i < close.length; i++) {
    const typicalPrice = (high[i] + low[i] + close[i]) / 3;
    cumulativePriceVolume += typicalPrice * volume[i];
    cumulativeVolume += volume[i];
    vwapValues.push(cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : typicalPrice);
  }
  return vwapValues;
};
  const prepareCandlestickData = () => {
  if (!ohlcData || ohlcData.length === 0) {
    return { x: [], open: [], high: [], low: [], close: [], volume: [], volumeStdDev: [], buyVolumes: [], sellVolumes: [] };
  }
  const validOhlcData = ohlcData.filter(candle => 
    candle.open !== null && candle.open !== undefined &&
    candle.high !== null && candle.high !== undefined &&
    candle.low !== null && candle.low !== undefined &&
    candle.close !== null && candle.close !== undefined &&
    candle.volume !== null && candle.volume !== undefined
  );
  if (validOhlcData.length === 0) {
    return { x: [], open: [], high: [], low: [], close: [], volume: [], volumeStdDev: [], buyVolumes: [], sellVolumes: [] };
  }
  const sortedData = [...validOhlcData].sort((a, b) => a.timestamp - b.timestamp);
  const buyVolumes = sortedData.map(candle => calculateBuySellVolume(candle).buyVolume);
  const sellVolumes = sortedData.map(candle => calculateBuySellVolume(candle).sellVolume);
  const volumeStdDev = sortedData.map((candle, index) => 
    calculateVolumeStandardDeviation(candle, index)
  );
  return {
    x: sortedData.map(candle => new Date(candle.timestamp * 1000)),
    open: sortedData.map(candle => Number(candle.open)),
    high: sortedData.map(candle => Number(candle.high)),
    low: sortedData.map(candle => Number(candle.low)),
    close: sortedData.map(candle => Number(candle.close)),
    volume: sortedData.map(candle => Number(candle.volume)),
    volumeStdDev: volumeStdDev,
    buyVolumes,
    sellVolumes
  };
};
  const calculateYAxisRange = () => {
    const timeRange = getTimeRange();
    if (!timeRange) return undefined;
    const startTime = timeRange[0].getTime() / 1000;
    const endTime = timeRange[1].getTime() / 1000;
    if (chartType === 'line') {
      if (historicalData.length === 0) return undefined;
      const visibleData = historicalData.filter(
        point => point.timestamp >= startTime && point.timestamp <= endTime
      );
      if (visibleData.length === 0) return undefined;
      const prices = visibleData.map(point => point.ltp).filter(p => p !== null && p !== undefined);
      if (prices.length === 0) return undefined;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const padding = (maxPrice - minPrice) * 0.05;
      return [minPrice - padding, maxPrice + padding];
    } else {
      if (!ohlcData || ohlcData.length === 0) return undefined;
      const visibleCandles = ohlcData.filter(
        candle => candle.timestamp >= startTime && candle.timestamp <= endTime
      );
      if (visibleCandles.length === 0) return undefined;
      const validCandles = visibleCandles.filter(candle => 
        candle.high !== null && candle.high !== undefined &&
        candle.low !== null && candle.low !== undefined
      );
      if (validCandles.length === 0) return undefined;
      const highPrices = validCandles.map(candle => Number(candle.high));
      const lowPrices = validCandles.map(candle => Number(candle.low));
      const minPrice = Math.min(...lowPrices);
      const maxPrice = Math.max(...highPrices);
      const padding = (maxPrice - minPrice) * 0.05;
      return [minPrice - padding, maxPrice + padding];
    }
  };
  const calculateBidAskRange = () => {
    const { bid, ask } = prepareLineChartData();
    const validBids = bid.filter(b => b !== null && b !== undefined) as number[];
    const validAsks = ask.filter(a => a !== null && a !== undefined) as number[];
    if (validBids.length === 0 || validAsks.length === 0) return undefined;
    const minBid = Math.min(...validBids);
    const maxAsk = Math.max(...validAsks);
    const padding = (maxAsk - minBid) * 0.05;
    return [minBid - padding, maxAsk + padding];
  };
  const calculateSpreadRange = () => {
    const { spread } = prepareLineChartData();
    const validSpreads = spread.filter(s => s !== null && s !== undefined) as number[];
    if (validSpreads.length === 0) return [0, 1];
    const minSpread = Math.min(...validSpreads);
    const maxSpread = Math.max(...validSpreads);
    const padding = Math.max((maxSpread - minSpread) * 0.1, 0.01);
    return [Math.max(0, minSpread - padding), maxSpread + padding];
  };
  const calculateBuySellVolumeRange = () => {
    let buyVolumes: number[] = [];
    let sellVolumes: number[] = [];
    if (chartType === 'line') {
      const { buyVolumes: bv, sellVolumes: sv } = prepareLineChartData();
      buyVolumes = bv.filter(v => v !== null && v !== undefined) as number[];
      sellVolumes = sv.filter(v => v !== null && v !== undefined) as number[];
    } else {
      const { buyVolumes: bv, sellVolumes: sv } = prepareCandlestickData();
      buyVolumes = bv.filter(v => v !== null && v !== undefined) as number[];
      sellVolumes = sv.filter(v => v !== null && v !== undefined) as number[];
    }
    if (buyVolumes.length === 0 && sellVolumes.length === 0) return [0, 1000];
    const maxBuyVolume = buyVolumes.length > 0 ? Math.max(...buyVolumes) : 0;
    const maxSellVolume = sellVolumes.length > 0 ? Math.max(...sellVolumes) : 0;
    const maxVolume = Math.max(maxBuyVolume, maxSellVolume);
    return [0, maxVolume * 1.1];
  };
  const getTimeRange = () => {
    const dataToUse = chartType === 'line' ? historicalData : ohlcData;
    if (!dataToUse || dataToUse.length === 0) return undefined;
    const now = data?.timestamp 
      ? new Date(data.timestamp * 1000) 
      : new Date();
    let startTime = new Date(now);
    switch (selectedTimeframe) {
      case '1m':
        startTime.setMinutes(now.getMinutes() - 1);
        break;
      case '5m':
        startTime.setMinutes(now.getMinutes() - 5);
        break;
      case '10m':
        startTime.setMinutes(now.getMinutes() - 10);
        break;
      case '30m':
        startTime.setMinutes(now.getMinutes() - 30);
        break;
      case '1H':
        startTime.setHours(now.getHours() - 1);
        break;
      case '6H':
        startTime.setHours(now.getHours() - 6);
        break;
      case '12H':
        startTime.setHours(now.getHours() - 12);
        break;
      case '1D':
      default:
        try {
          const tradingStart = new Date(tradingHours.start);
          return [tradingStart, now > new Date(tradingHours.end) ? new Date(tradingHours.end) : now];
        } catch (e) {
          startTime.setHours(now.getHours() - 24);
        }
    }
    return [startTime, now];
  };
  const getColorTheme = () => {
    return {
      bg: '#18181b',
      paper: '#18181b',
      text: '#e4e4e7',
      grid: '#27272a',
      line: getLineColor(),
      upColor: '#22c55e',
      downColor: '#ef4444',
      button: {
        bg: '#27272a',
        bgActive: '#3b82f6',
        text: '#e4e4e7'
      },
      indicator: {
        sma20: '#f97316',
        ema9: '#8b5cf6',
        rsi: '#06b6d4',
        macd: '#3b82f6',
        bb: '#64748b',
        vwap: '#06b6d4',
        bid: '#22c55e',
        ask: '#ef4444',
        spread: '#3b82f6',
        buyVolume: '#22c55e',
        sellVolume: '#ef4444'
      }
    };
  };
  const getLineColor = () => {
    const { y } = prepareLineChartData();
    if (y.length < 2) return '#22d3ee';
    const lastPrice = y[y.length - 1];
    const prevPrice = y[y.length - 2];
    return lastPrice >= prevPrice ? '#22c55e' : '#ef4444';
  };
  const handleTimeframeChange = (timeframe: string) => {
  setSelectedTimeframe(timeframe);
  setPreservedAxisRanges({});
  if (!chartRef.current) return;
  const plotDiv = document.getElementById('plotly-chart');
  if (!plotDiv) return;
  try {
    const newTimeRange = getTimeRange();
    const newYRange = calculateYAxisRange();
    Plotly.relayout(plotDiv, {
      'xaxis.range': newTimeRange,
      'xaxis.autorange': false,
      'yaxis.range': newYRange,
      'yaxis.autorange': newYRange ? false : true
    });
    const spreadDiv = document.getElementById('spread-chart');
    if (spreadDiv && showIndicators.bidAskSpread) {
      Plotly.relayout(spreadDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateSpreadRange(),
        'yaxis.autorange': false
      });
    }
    const bidAskDiv = document.getElementById('bid-ask-chart');
    if (bidAskDiv && showIndicators.bidAsk) {
      Plotly.relayout(bidAskDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateBidAskRange(),
        'yaxis.autorange': false
      });
    }
    const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
    if (buySellVolumeDiv && showIndicators.buySellVolume) {
      Plotly.relayout(buySellVolumeDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateBuySellVolumeRange(),
        'yaxis.autorange': false
      });
    }
  } catch (err) {
    console.error('Error updating timeframe:', err);
    setTimeout(() => {
      try {
        if (chartRef.current) {
          const plotDiv = document.getElementById('plotly-chart');
          if (plotDiv) {
            Plotly.react(plotDiv, createPlotData(), createLayout());
          }
        }
      } catch (fallbackErr) {
        console.error('Fallback chart update failed:', fallbackErr);
      }
    }, 100);
  }
};
const toggleChartType = () => {
  const plotDiv = document.getElementById('plotly-chart');
  if (plotDiv && plotDiv.layout) {
    const currentLayout = plotDiv.layout;
    setPreservedAxisRanges({
      xaxis: currentLayout.xaxis?.range ? [
        new Date(currentLayout.xaxis.range[0]), 
        new Date(currentLayout.xaxis.range[1])
      ] : undefined,
      yaxis: currentLayout.yaxis?.range ? [
        currentLayout.yaxis.range[0], 
        currentLayout.yaxis.range[1]
      ] : undefined
    });
  }
  setChartType(prev => prev === 'line' ? 'candle' : 'line');
};
  const toggleIndicator = (indicator: 'sma20' | 'ema9' | 'rsi' | 'macd' | 'bb' | 'vwap' | 'bidAsk' | 'bidAskSpread' | 'buySellVolume') => {
    setShowIndicators(prev => ({
      ...prev,
      [indicator]: !prev[indicator]
    }));
  };
  const handleRelayout = (eventData: any) => {
    if (eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
      const startDate = new Date(eventData['xaxis.range[0]']);
      const endDate = new Date(eventData['xaxis.range[1]']);
      const startTime = startDate.getTime() / 1000;
      const endTime = endDate.getTime() / 1000;
      let minValue, maxValue;
      if (chartType === 'line') {
        const visibleData = historicalData.filter(
          point => point.timestamp >= startTime && point.timestamp <= endTime
        );
        if (visibleData.length > 0) {
          const prices = visibleData.map(point => point.ltp).filter(p => p !== null && p !== undefined);
          if (prices.length > 0) {
            minValue = Math.min(...prices);
            maxValue = Math.max(...prices);
          }
        }
      } else {
        const visibleData = ohlcData.filter(
          candle => candle.timestamp >= startTime && candle.timestamp <= endTime
        );
        if (visibleData.length > 0) {
          const validCandles = visibleData.filter(candle => 
            candle.high !== null && candle.high !== undefined &&
            candle.low !== null && candle.low !== undefined
          );
          if (validCandles.length > 0) {
            const highPrices = validCandles.map(candle => Number(candle.high));
            const lowPrices = validCandles.map(candle => Number(candle.low));
            minValue = Math.min(...lowPrices);
            maxValue = Math.max(...highPrices);
          }
        }
      }
      if (minValue !== undefined && maxValue !== undefined) {
        const padding = (maxValue - minValue) * 0.05;
        const yRange = [minValue - padding, maxValue + padding];
        const plotDiv = document.getElementById('plotly-chart');
        if (plotDiv) {
          Plotly.relayout(plotDiv, {
            'yaxis.range': yRange,
            'yaxis.autorange': false
          });
        }
        const bidAskDiv = document.getElementById('bid-ask-chart');
        if (bidAskDiv) {
          Plotly.relayout(bidAskDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
        const spreadDiv = document.getElementById('spread-chart');
        if (spreadDiv) {
          Plotly.relayout(spreadDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
        const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
        if (buySellVolumeDiv) {
          Plotly.relayout(buySellVolumeDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
      }
    }
  };
  useEffect(() => {
    if (!chartRef.current) return;
    const plotDiv = document.getElementById('plotly-chart');
    if (!plotDiv) return;
    if (!initialized) {
      setInitialized(true);
      return;
    }
    try {
      if (chartType === 'line') {
        const { x, y } = prepareLineChartData();
        if (x.length === 0 || y.length === 0) return;
        Plotly.react(plotDiv, createPlotData(), createLayout());
      } else {
        const { x, open, high, low, close } = prepareCandlestickData();
        if (x.length === 0) return;
        Plotly.react(plotDiv, createPlotData(), createLayout());
      }
      if (showIndicators.bidAsk) {
        const bidAskDiv = document.getElementById('bid-ask-chart');
        if (bidAskDiv) {
          const { x, bid, ask } = prepareLineChartData();
          Plotly.react(bidAskDiv, createBidAskData(), createBidAskLayout());
        }
      }
      if (showIndicators.bidAskSpread) {
        const spreadDiv = document.getElementById('spread-chart');
        if (spreadDiv) {
          const { x, spread } = prepareLineChartData();
          Plotly.react(spreadDiv, createSpreadData(), createSpreadLayout());
        }
      }
      if (showIndicators.buySellVolume) {
        const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
        if (buySellVolumeDiv) {
          Plotly.react(buySellVolumeDiv, createBuySellVolumeData(), createBuySellVolumeLayout());
        }
      }
    } catch (err) {
      console.error('Error updating chart:', err);
    }
  }, [data, historicalData, ohlcData, initialized, selectedTimeframe, chartType, showIndicators]);
const createPlotData = () => {
  const colors = getColorTheme();
  let plotData: any[] = [];
  if (chartType === 'line') {
    if (historicalData && historicalData.length > 0) {
      const validData = historicalData.filter(point => 
        point.ltp !== null && 
        point.ltp !== undefined && 
        point.ltp > 0 && 
        !isNaN(point.ltp) &&
        point.timestamp !== null &&
        point.timestamp !== undefined
      );
      if (validData.length === 0) return plotData;
      const sortedData = [...validData].sort((a, b) => a.timestamp - b.timestamp);
      const timeValues = sortedData.map(point => new Date(point.timestamp * 1000));
      const priceValues = sortedData.map(point => Number(point.ltp));
      plotData.push({
        x: timeValues,
        y: priceValues,
        type: 'scatter',
        mode: 'lines',
        name: 'LTP',
        line: {
          color: colors.line || '#3B82F6',
          width: 2,
          shape: 'linear'
        },
        connectgaps: false,
        hovertemplate: '<b>%{fullData.name}</b><br>' +
                      'Time: %{x|%H:%M:%S}<br>' +
                      'Price: ₹%{y:.2f}<br>' +
                      '<extra></extra>',
        showlegend: true
      });
      if (showIndicators.sma20 && priceValues.length >= 20) {
        const sma20Values = calculateSMA(priceValues, 20);
        if (sma20Values && sma20Values.length > 0) {
          plotData.push({
            x: timeValues.slice(19),
            y: sma20Values,
            type: 'scatter',
            mode: 'lines',
            name: 'SMA 20',
            line: {
              color: colors.indicator?.sma20 || '#f59e0b',
              width: 1.5,
              dash: 'dot'
            },
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
                          'Time: %{x|%H:%M:%S}<br>' +
                          'SMA20: ₹%{y:.2f}<br>' +
                          '<extra></extra>',
            showlegend: true
          });
        }
      }
      if (showIndicators.ema9 && priceValues.length >= 9) {
        const ema9Values = calculateEMA(priceValues, 9);
        if (ema9Values && ema9Values.length > 0) {
          plotData.push({
            x: timeValues,
            y: ema9Values,
            type: 'scatter',
            mode: 'lines',
            name: 'EMA 9',
            line: {
              color: colors.indicator?.ema9 || '#8b5cf6',
              width: 1.5,
              dash: 'dash'
            },
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
                          'Time: %{x|%H:%M:%S}<br>' +
                          'EMA9: ₹%{y:.2f}<br>' +
                          '<extra></extra>',
            showlegend: true
          });
        }
      }
      if (showIndicators.bb && priceValues.length >= 20) {
        const bbData = calculateBollingerBands(priceValues, 20, 2);
        if (bbData && bbData.upper && bbData.middle && bbData.lower) {
          plotData.push({
            x: timeValues.slice(19),
            y: bbData.upper,
            type: 'scatter',
            mode: 'lines',
            name: 'BB Upper',
            line: {
              color: colors.indicator?.bb || '#64748b',
              width: 1,
              dash: 'dashdot'
            },
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
                          'Time: %{x|%H:%M:%S}<br>' +
                          'Upper: ₹%{y:.2f}<br>' +
                          '<extra></extra>',
            showlegend: true
          });
          plotData.push({
            x: timeValues.slice(19),
            y: bbData.middle,
            type: 'scatter',
            mode: 'lines',
            name: 'BB Middle',
            line: {
              color: colors.indicator?.bb || '#64748b',
              width: 1
            },
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
                          'Time: %{x|%H:%M:%S}<br>' +
                          'Middle: ₹%{y:.2f}<br>' +
                          '<extra></extra>',
            showlegend: true
          });
          plotData.push({
            x: timeValues.slice(19),
            y: bbData.lower,
            type: 'scatter',
            mode: 'lines',
            name: 'BB Lower',
            line: {
              color: colors.indicator?.bb || '#64748b',
              width: 1,
              dash: 'dashdot'
            },
            fill: 'tonexty',
            fillcolor: 'rgba(100, 116, 139, 0.1)',
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
                          'Time: %{x|%H:%M:%S}<br>' +
                          'Lower: ₹%{y:.2f}<br>' +
                          '<extra></extra>',
            showlegend: true
          });
        }
      }
    }
  } else {
    const { x, open, high, low, close, volume, volumeStdDev, buyVolumes, sellVolumes } = prepareCandlestickData();
    if (x.length === 0) return plotData;
    plotData.push({
      x: x,
      open: open,
      high: high,
      low: low,
      close: close,
      type: 'candlestick',
      name: 'OHLC',
      increasing: {
        line: { 
          color: colors.upColor || '#10b981', 
          width: 1 
        },
        fillcolor: colors.upColor || '#10b981'
      },
      decreasing: {
        line: { 
          color: colors.downColor || '#ef4444', 
          width: 1 
        },
        fillcolor: colors.downColor || '#ef4444'
      },
      hovertemplate: '<b>%{fullData.name}</b><br>' +
                    'Time: %{x|%H:%M:%S}<br>' +
                    'Open: ₹%{open:.2f}<br>' +
                    'High: ₹%{high:.2f}<br>' +
                    'Low: ₹%{low:.2f}<br>' +
                    'Close: ₹%{close:.2f}<br>' +
                    '<extra></extra>',
      showlegend: true
    });
    if (showIndicators.sma20 && close.length >= 20) {
      const sma20Values = calculateSMA(close, 20);
      if (sma20Values && sma20Values.length > 0) {
        plotData.push({
          x: x.slice(19),
          y: sma20Values,
          type: 'scatter',
          mode: 'lines',
          name: 'SMA 20',
          line: {
            color: colors.indicator?.sma20 || '#f59e0b',
            width: 2,
            dash: 'dot'
          },
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'SMA20: ₹%{y:.2f}<br>' +
                        '<extra></extra>',
          showlegend: true
        });
      }
    }
    if (showIndicators.ema9 && close.length >= 9) {
      const ema9Values = calculateEMA(close, 9);
      if (ema9Values && ema9Values.length > 0) {
        plotData.push({
          x: x,
          y: ema9Values,
          type: 'scatter',
          mode: 'lines',
          name: 'EMA 9',
          line: {
            color: colors.indicator?.ema9 || '#8b5cf6',
            width: 2,
            dash: 'dash'
          },
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'EMA9: ₹%{y:.2f}<br>' +
                        '<extra></extra>',
          showlegend: true
        });
      }
    }
    if (showIndicators.bb && close.length >= 20) {
      const bbData = calculateBollingerBands(close, 20, 2);
      if (bbData && bbData.upper && bbData.middle && bbData.lower) {
        plotData.push({
          x: x.slice(19),
          y: bbData.upper,
          type: 'scatter',
          mode: 'lines',
          name: 'BB Upper',
          line: {
            color: colors.indicator?.bb || '#64748b',
            width: 1,
            dash: 'dashdot'
          },
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'Upper: ₹%{y:.2f}<br>' +
                        '<extra></extra>',
          showlegend: true
        });
        plotData.push({
          x: x.slice(19),
          y: bbData.middle,
          type: 'scatter',
          mode: 'lines',
          name: 'BB Middle',
          line: {
            color: colors.indicator?.bb || '#64748b',
            width: 1
          },
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'Middle: ₹%{y:.2f}<br>' +
                        '<extra></extra>',
          showlegend: true
        });
        plotData.push({
          x: x.slice(19),
          y: bbData.lower,
          type: 'scatter',
          mode: 'lines',
          name: 'BB Lower',
          line: {
            color: colors.indicator?.bb || '#64748b',
            width: 1,
            dash: 'dashdot'
          },
          fill: 'tonexty',
          fillcolor: 'rgba(100, 116, 139, 0.1)',
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'Lower: ₹%{y:.2f}<br>' +
                        '<extra></extra>',
          showlegend: true
        });
      }
    }
    if (showIndicators.vwap && close.length > 0 && volume && volume.length > 0) {
      const vwapValues = calculateVWAP(close, high, low, volume);
      if (vwapValues && vwapValues.length > 0) {
        plotData.push({
          x: x,
          y: vwapValues,
          type: 'scatter',
          mode: 'lines',
          name: 'VWAP',
          line: {
            color: colors.indicator?.vwap || '#06b6d4',
            width: 2,
            dash: 'solid'
          },
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'VWAP: ₹%{y:.2f}<br>' +
                        '<extra></extra>',
          showlegend: true
        });
      }
    }
  }
  if (showIndicators.rsi) {
    const priceData = chartType === 'line' 
      ? historicalData?.filter(point => 
          point.ltp !== null && 
          point.ltp !== undefined && 
          point.ltp > 0 && 
          !isNaN(point.ltp)
        ).map(point => Number(point.ltp)) || []
      : close.filter(price => price !== null && price !== undefined && !isNaN(price));
    if (priceData.length >= 14) {
      const rsiValues = calculateRSI(priceData, 14);
      const timeData = chartType === 'line'
        ? historicalData?.filter(point => 
            point.ltp !== null && 
            point.ltp !== undefined && 
            point.ltp > 0 && 
            !isNaN(point.ltp)
          ).slice(13).map(point => new Date(point.timestamp * 1000)) || []
        : x.slice(13);
      if (rsiValues && rsiValues.length > 0 && timeData.length > 0) {
        plotData.push({
          x: timeData,
          y: rsiValues,
          type: 'scatter',
          mode: 'lines',
          name: 'RSI',
          line: {
            color: colors.indicator?.rsi || '#ec4899',
            width: 2
          },
          yaxis: 'y2',
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'RSI: %{y:.2f}<br>' +
                        '<extra></extra>',
          showlegend: true
        });
        plotData.push({
          x: timeData,
          y: Array(timeData.length).fill(70),
          type: 'scatter',
          mode: 'lines',
          name: 'Overbought (70)',
          line: {
            color: '#ef4444',
            width: 1,
            dash: 'dash'
          },
          yaxis: 'y2',
          showlegend: false,
          hoverinfo: 'skip'
        });
        plotData.push({
          x: timeData,
          y: Array(timeData.length).fill(30),
          type: 'scatter',
          mode: 'lines',
          name: 'Oversold (30)',
          line: {
            color: '#10b981',
            width: 1,
            dash: 'dash'
          },
          yaxis: 'y2',
          showlegend: false,
          hoverinfo: 'skip'
        });
        plotData.push({
          x: timeData,
          y: Array(timeData.length).fill(50),
          type: 'scatter',
          mode: 'lines',
          name: 'Midline (50)',
          line: {
            color: '#64748b',
            width: 1,
            dash: 'dot'
          },
          yaxis: 'y2',
          showlegend: false,
          hoverinfo: 'skip'
        });
      }
    }
  }
  if (showIndicators.macd) {
    const priceData = chartType === 'line' 
      ? historicalData?.filter(point => 
          point.ltp !== null && 
          point.ltp !== undefined && 
          point.ltp > 0 && 
          !isNaN(point.ltp)
        ).map(point => Number(point.ltp)) || []
      : close.filter(price => price !== null && price !== undefined && !isNaN(price));
    if (priceData.length >= 26) {
      const macdData = calculateMACD(priceData, 12, 26, 9);
      const timeData = chartType === 'line'
        ? historicalData?.filter(point => 
            point.ltp !== null && 
            point.ltp !== undefined && 
            point.ltp > 0 && 
            !isNaN(point.ltp)
          ).slice(25).map(point => new Date(point.timestamp * 1000)) || []
        : x.slice(25);
      if (macdData && macdData.macdLine && macdData.signalLine && macdData.histogram && timeData.length > 0) {
        plotData.push({
          x: timeData,
          y: macdData.macdLine,
          type: 'scatter',
          mode: 'lines',
          name: 'MACD',
          line: {
            color: colors.indicator?.macd || '#3b82f6',
            width: 2
          },
          yaxis: showIndicators.rsi ? 'y4' : 'y2',
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'MACD: %{y:.4f}<br>' +
                        '<extra></extra>',
          showlegend: true
        });
        plotData.push({
          x: timeData,
          y: macdData.signalLine,
          type: 'scatter',
          mode: 'lines',
          name: 'Signal',
          line: {
            color: '#f59e0b',
            width: 1,
            dash: 'dash'
          },
          yaxis: showIndicators.rsi ? 'y4' : 'y2',
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'Signal: %{y:.4f}<br>' +
                        '<extra></extra>',
          showlegend: true
        });
        plotData.push({
          x: timeData,
          y: macdData.histogram,
          type: 'bar',
          name: 'MACD Histogram',
          marker: {
            color: macdData.histogram.map(val => val >= 0 ? '#10b981' : '#ef4444'),
            opacity: 0.7
          },
          yaxis: showIndicators.rsi ? 'y4' : 'y2',
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'Histogram: %{y:.4f}<br>' +
                        '<extra></extra>',
          showlegend: true
        });
      }
    }
  }
  return plotData;
};
  const createSpreadData = () => {
    const colors = getColorTheme();
    const { x, spread } = prepareLineChartData();
    return [{
      x,
      y: spread,
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      line: { color: colors.indicator.spread, width: 1.5 },
      name: 'Bid-Ask Spread',
      hoverinfo: 'y+name',
    }];
  };
  const createBidAskData = () => {
    const colors = getColorTheme();
    const { x, bid, ask } = prepareLineChartData();
    return [
      {
        x,
        y: bid,
        type: 'scatter',
        mode: 'lines',
        line: { color: colors.indicator.bid, width: 2 },
        name: 'Bid Price',
        hoverinfo: 'y+name',
      },
      {
        x,
        y: ask,
        type: 'scatter',
        mode: 'lines',
        line: { color: colors.indicator.ask, width: 2 },
        name: 'Ask Price',
        hoverinfo: 'y+name',
      }
    ];
  };
 const createBuySellVolumeData = () => {
  const colors = getColorTheme();
  let x: Date[] = [];
  let volumeStdDev: number[] = [];
  if (chartType === 'line') {
    const data = prepareLineChartData();
    x = data.x;
    volumeStdDev = data.allData.map((point, index) => 
      calculateVolumeStandardDeviation(point, index)
    );
  } else {
    const data = prepareCandlestickData();
    x = data.x;
    volumeStdDev = data.volumeStdDev;
  }
  return [
    {
      x,
      y: volumeStdDev,
      type: 'bar',
      name: 'Volume Std Dev',
      marker: { 
        color: volumeStdDev.map((val, i) => {
          if (chartType === 'candle') {
            const { close, open } = prepareCandlestickData();
            if (close[i] && open[i]) {
              return close[i] >= open[i] ? colors.upColor : colors.downColor;
            }
          } else {
            const maxStdDev = Math.max(...volumeStdDev);
            const intensity = val / maxStdDev;
            return `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`;
          }
          return colors.grid;
        }),
        opacity: 0.8 
      },
      hovertemplate: '<b>%{fullData.name}</b><br>' +
                    'Time: %{x|%H:%M:%S}<br>' +
                    'Std Dev: %{y:.4f}<br>' +
                    '<extra></extra>',
    }
  ];
};
  const createLayout = () => {
  const colors = getColorTheme();
  const timeRange = preservedAxisRanges.xaxis ? 
    [preservedAxisRanges.xaxis[0], preservedAxisRanges.xaxis[1]] : 
    getTimeRange();
  const yRange = preservedAxisRanges.yaxis ? 
    [preservedAxisRanges.yaxis[0], preservedAxisRanges.yaxis[1]] : 
    calculateYAxisRange();
  let mainChartDomain = [0, 1];
  if (showIndicators.rsi && showIndicators.macd) {
    mainChartDomain = [0.5, 1];
  } else if (showIndicators.rsi || showIndicators.macd) {
    mainChartDomain = [0.3, 1];
  } 
  const layout: any = {
    autosize: true,
    margin: { l: 50, r: 50, t: 40, b: 40 },
    title: {
      text: `${symbol} ${chartType === 'line' ? 'LTP' : 'OHLC'} Chart`,
      font: { size: 16, color: colors.text },
    },
    xaxis: {
      title: 'Time',
      type: 'date',
      range: timeRange,
      gridcolor: colors.grid,
      linecolor: colors.grid,
      tickfont: { color: colors.text },
      titlefont: { color: colors.text },
      rangeslider: { visible: false },
      fixedrange: false,
    },
    yaxis: {
      title: 'Price (₹)',
      range: yRange,
      autorange: yRange ? false : true,
      fixedrange: false,
      gridcolor: colors.grid,
      linecolor: colors.grid,
      tickfont: { color: colors.text },
      titlefont: { color: colors.text },
      side: 'left',
      domain: mainChartDomain,
    },
    hovermode: 'closest',
    showlegend: true,
    legend: {
      orientation: 'h',
      y: 1.1,
      font: { color: colors.text },
      bgcolor: 'rgba(0,0,0,0)',
    },
    plot_bgcolor: colors.bg,
    paper_bgcolor: colors.paper,
    font: { family: 'Arial, sans-serif', color: colors.text },
  };
  if (showIndicators.rsi) {
    layout.yaxis2 = {
      title: 'RSI',
      titlefont: { color: colors.text },
      tickfont: { color: colors.text },
      domain: showIndicators.macd ? [0.25, 0.45] : [0, 0.25],
      range: [0, 100],
      showgrid: false,
    };
  }
  if (showIndicators.macd) {
    layout.yaxis4 = {
      title: 'MACD',
      titlefont: { color: colors.text },
      tickfont: { color: colors.text },
      domain: [0, 0.2],
      showgrid: false,
    };
  }
  return layout;
};
  const createSpreadLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const spreadRange = calculateSpreadRange();
    return {
      autosize: true,
      height: 150,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: 'Bid-Ask Spread',
        font: { size: 14, color: colors.text },
      },
      xaxis: {
        title: '',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: { visible: false },
        fixedrange: false,
      },
      yaxis: {
        title: 'Spread (₹)',
        range: spreadRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
      },
      hovermode: 'closest',
      showlegend: false,
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
  };
  const createBidAskLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const bidAskRange = calculateBidAskRange();
    return {
      autosize: true,
      height: 200,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: 'Bid-Ask Prices',
        font: { size: 14, color: colors.text },
      },
      xaxis: {
        title: '',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: { visible: false },
        fixedrange: false,
      },
      yaxis: {
        title: 'Price (₹)',
        range: bidAskRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        orientation: 'h',
        y: 1.1,
        font: { color: colors.text },
        bgcolor: 'rgba(0,0,0,0)',
      },
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
  };
  const createBuySellVolumeLayout = () => {
  const colors = getColorTheme();
  const timeRange = getTimeRange();
  let volumeStdDev: number[] = [];
  if (chartType === 'line') {
    volumeStdDev = historicalData.map((point, index) => 
      calculateVolumeStandardDeviation(point, index)
    );
  } else {
    const { volumeStdDev: stdDev } = prepareCandlestickData();
    volumeStdDev = stdDev;
  }
  const validStdDev = volumeStdDev.filter(v => v !== null && v !== undefined && !isNaN(v));
  const maxStdDev = validStdDev.length > 0 ? Math.max(...validStdDev) : 1;
  const volumeRange = [0, maxStdDev * 1.1];
  return {
    autosize: true,
    height: 180,
    margin: { l: 50, r: 50, t: 30, b: 30 },
    title: {
      text: 'Volume Standard Deviation',
      font: { size: 14, color: colors.text },
    },
    xaxis: {
      title: '',
      type: 'date',
      range: timeRange,
      gridcolor: colors.grid,
      linecolor: colors.grid,
      tickfont: { color: colors.text },
      titlefont: { color: colors.text },
      rangeslider: { visible: false },
      fixedrange: false,
    },
    yaxis: {
      title: 'Std Deviation',
      range: volumeRange,
      autorange: false,
      fixedrange: false,
      gridcolor: colors.grid,
      linecolor: colors.grid,
      tickfont: { color: colors.text },
      titlefont: { color: colors.text },
    },
    hovermode: 'closest',
    showlegend: true,
    legend: {
      orientation: 'h',
      y: 1.1,
      font: { color: colors.text },
      bgcolor: 'rgba(0,0,0,0)',
    },
    plot_bgcolor: colors.bg,
    paper_bgcolor: colors.paper,
    font: { family: 'Arial, sans-serif', color: colors.text },
  };
};
  const timeframeButtons = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '10m', value: '10m' },
    { label: '30m', value: '30m' },
    { label: '1H', value: '1H' },
    { label: '6H', value: '6H' },
    { label: '12H', value: '12H' },
    { label: '1D', value: '1D' },
  ];
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between mb-2">
        <div className="flex space-x-1">
          {timeframeButtons.map((button) => (
            <button
              key={button.value}
              className={`px-2 py-1 text-xs rounded ${
                selectedTimeframe === button.value
                  ? `bg-blue-600 text-white`
                  : `bg-zinc-800 text-zinc-300 hover:bg-zinc-700`
              }`}
              onClick={() => handleTimeframeChange(button.value)}
            >
              {button.label}
            </button>
          ))}
        </div>
        <div className="flex space-x-2">
          <button
            className={`p-1 rounded ${
              chartType === 'line' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setChartType('line')}
            title="Line Chart (LTP)"
          >
            <LineChart className="h-5 w-5" />
          </button>
          <button
            className={`p-1 rounded ${
              chartType === 'candle' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setChartType('candle')}
            title="Candlestick Chart (OHLC)"
          >
            <CandlestickChart className="h-5 w-5" />
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.sma20 ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('sma20')}
            title="SMA 20"
          >
            <span className="text-xs font-bold">SMA</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.ema9 ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('ema9')}
            title="EMA 9"
          >
            <span className="text-xs font-bold">EMA</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.bb ? 'bg-gray-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('bb')}
            title="Bollinger Bands"
          >
            <span className="text-xs font-bold">BB</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.vwap ? 'bg-cyan-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('vwap')}
            title="VWAP"
          >
            <span className="text-xs font-bold">VWAP</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.rsi ? 'bg-pink-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('rsi')}
            title="RSI 14"
          >
            <span className="text-xs font-bold">RSI</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.macd ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('macd')}
            title="MACD"
          >
            <span className="text-xs font-bold">MACD</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.bidAsk ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('bidAsk')}
            title="Bid-Ask Lines"
          >
            <span className="text-xs font-bold">B/A</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.bidAskSpread ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('bidAskSpread')}
            title="Bid-Ask Spread"
          >
            <span className="text-xs font-bold">SPR</span>
          </button>
         <button
  className={`p-1 rounded ${
    showIndicators.buySellVolume ? 'bg-yellow-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
  }`}
  onClick={() => toggleIndicator('buySellVolume')}
  title="Volume Standard Deviation"
>
  <span className="text-xs font-bold">STD</span> {}
</button>
        </div>
      </div>
      <div className="flex-grow mb-2">
        <Plot
          id="plotly-chart"
          ref={chartRef}
          data={createPlotData()}
          layout={createLayout()}
          config={{
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: [
              'select2d',
              'lasso2d',
              'autoScale2d',
              'toggleSpikelines',
            ],
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
          onRelayout={handleRelayout}
        />
      </div>
      {showIndicators.buySellVolume && (
        <div className="h-[180px] mb-2">
          <Plot
            id="buy-sell-volume-chart"
            ref={buySellVolumeChartRef}
            data={createBuySellVolumeData()}
            layout={createBuySellVolumeLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              displaylogo: false,
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </div>
      )}
      {showIndicators.bidAsk && (
        <div className="h-[200px] mb-2">
          <Plot
            id="bid-ask-chart"
            ref={bidAskChartRef}
            data={createBidAskData()}
            layout={createBidAskLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              displaylogo: false,
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </div>
      )}
      {showIndicators.bidAskSpread && (
        <div className="h-[150px]">
          <Plot
            id="spread-chart"
            ref={spreadChartRef}
            data={createSpreadData()}
            layout={createSpreadLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              displaylogo: false,
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </div>
      )}
    </div>
  );
};
export default PlotlyChart;

