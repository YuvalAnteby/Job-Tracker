import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Job } from '../../jobs/entities/job.entity';

export enum ApplicationActionState {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DISMISSED = 'DISMISSED',
}

@Entity('application_actions')
export class ApplicationAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  job_id: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column('text')
  label: string;

  @Column({ type: 'timestamptz' })
  due_at: Date;

  @Column({ type: 'enum', enum: ApplicationActionState })
  state: ApplicationActionState;

  @Column('int', { default: 1 })
  revision: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
