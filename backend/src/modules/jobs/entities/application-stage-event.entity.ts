import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApplicationStage } from '../enums/application-stage.enum';
import { Job } from './job.entity';

@Entity('application_stage_events')
export class ApplicationStageEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  job_id: string;

  @ManyToOne(() => Job, (job) => job.application_events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column({ type: 'enum', enum: ApplicationStage })
  previous_stage: ApplicationStage;

  @Column({ type: 'enum', enum: ApplicationStage })
  new_stage: ApplicationStage;

  @Column({ type: 'timestamptz' })
  occurred_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  recorded_at: Date;

  @Column('text', { default: 'WEB' })
  source: string;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('text', { nullable: true })
  rejection_reason: string | null;
}
