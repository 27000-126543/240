import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TaskStatus, ProcessParams, SimulationResult } from '../types';
import { Warning } from './Warning';
import { Approval } from './Approval';
import { ParamAdjustment } from './ParamAdjustment';

@Entity()
export class Task {
  @PrimaryColumn()
  id: string;

  @Column()
  batchId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  maskFile: string;

  @Column({ type: 'simple-json', nullable: true })
  maskData: any;

  @Column({
    type: 'text',
    default: 'pending'
  })
  status: TaskStatus;

  @Column({ type: 'float', default: 0 })
  progress: number;

  @Column({ type: 'simple-json' })
  parameters: ProcessParams;

  @Column({ type: 'simple-json', nullable: true })
  result: SimulationResult;

  @Column({ type: 'simple-json', nullable: true })
  realtimeMetrics: any[];

  @OneToMany(() => Warning, warning => warning.task)
  warnings: Warning[];

  @OneToMany(() => Approval, approval => approval.task)
  approvals: Approval[];

  @OneToMany(() => ParamAdjustment, adjustment => adjustment.task)
  adjustments: ParamAdjustment[];

  @Column({ default: 0 })
  adjustCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
