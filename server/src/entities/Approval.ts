import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ApprovalLevel, ApprovalStatus } from '../types';
import { Task } from './Task';

@Entity()
export class Approval {
  @PrimaryColumn()
  id: string;

  @Column()
  taskId: string;

  @ManyToOne(() => Task, task => task.approvals)
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ type: 'text' })
  level: ApprovalLevel;

  @Column()
  approver: string;

  @Column({
    type: 'text',
    default: 'pending'
  })
  status: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  decidedAt: Date;
}
