import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import { ProcessParams } from '../types';

@Entity()
export class Recommendation {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ type: 'simple-json' })
  parameters: ProcessParams;

  @Column({ type: 'float' })
  score: number;

  @Column({ type: 'float' })
  predictedAngle: number;

  @Column({ type: 'float' })
  predictedSelectivity: number;

  @Column({ type: 'float' })
  predictedUniformity: number;

  @Column({ default: 0 })
  usageCount: number;

  @Column({ type: 'simple-json' })
 适用场景: string[];

  @CreateDateColumn()
  createdAt: Date;
}
