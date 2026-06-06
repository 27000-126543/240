import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Task } from './entities/Task';
import { Batch } from './entities/Batch';
import { Warning } from './entities/Warning';
import { Approval } from './entities/Approval';
import { ParamAdjustment } from './entities/ParamAdjustment';
import { Recommendation } from './entities/Recommendation';
import { DailyStats } from './entities/DailyStats';

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: './plasma_etching.db',
  synchronize: true,
  logging: false,
  entities: [Task, Batch, Warning, Approval, ParamAdjustment, Recommendation, DailyStats],
  migrations: [],
  subscribers: [],
});
