import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ProcessParams } from '../types';
import { Task } from './Task';

@Entity()
export class ParamAdjustment {
  @PrimaryColumn()
  id: string;

  @Column()
  taskId: string;

  @ManyToOne(() => Task, task => task.adjustments)
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ type: 'simple-json' })
  beforeParams: ProcessParams;

  @Column({ type: 'simple-json' })
  afterParams: ProcessParams;

  @Column()
  reason: string;

  @Column()
  adjustedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
