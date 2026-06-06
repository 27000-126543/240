import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { WarningType } from '../types';
import { Task } from './Task';

@Entity()
export class Warning {
  @PrimaryColumn()
  id: string;

  @Column()
  taskId: string;

  @ManyToOne(() => Task, task => task.warnings)
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ type: 'text' })
  type: WarningType;

  @Column()
  message: string;

  @Column({ type: 'float' })
  threshold: number;

  @Column({ type: 'float' })
  actualValue: number;

  @Column({ default: false })
  acknowledged: boolean;

  @Column({ nullable: true })
  acknowledgedBy: string;

  @Column({ type: 'text', nullable: true })
  ackComment: string;

  @CreateDateColumn()
  createdAt: Date;
}
