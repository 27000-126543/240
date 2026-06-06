import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { BatchStatus } from '../types';
import { Task } from './Task';

@Entity()
export class Batch {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'text',
    default: 'active'
  })
  status: BatchStatus;

  @Column({ default: 0 })
  nonuniformCount: number;

  @Column({ default: 0 })
  taskCount: number;

  @Column({ default: 0 })
  completedCount: number;

  @Column({ type: 'text', nullable: true })
  pauseReason: string;

  @OneToMany(() => Task, task => task.batchId)
  tasks: Task[];

  @CreateDateColumn()
  createdAt: Date;
}
