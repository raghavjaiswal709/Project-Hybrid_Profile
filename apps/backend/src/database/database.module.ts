import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockData } from '../stock/entities/stock.entity';
import * as dotenv from 'dotenv';

dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '8709',
      database: process.env.DB_DATABASE || 'StockDashboard',
      entities: [StockData],
      synchronize: false,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      logging: process.env.NODE_ENV !== 'production',
      retryAttempts: 3,
      retryDelay: 300000,
      autoLoadEntities: true,
    }),
  ],
})
export class DatabaseModule {}
