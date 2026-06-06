import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class DailyStats {
  @PrimaryColumn()
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'float', default: 0 })
  completionRate: number;

  @Column({ type: 'float', default: 0 })
  rateDeviation: number;

  @Column({ default: 0 })
  optimizationCount: number;

  @Column({ default: 0 })
  totalTasks: number;

  @Column({ default: 0 })
  completedTasks: number;

  @Column({ default: 0 })
  warningCount: number;

  @Column({ default: 0 })
  approvalCount: number;

  @Column({ type: 'simple-json', nullable: true })
  processCapability: {
    dimension: string;
    value: number;
    fullMark: number;
  }[];

  @CreateDateColumn()
  createdAt: Date;
}
