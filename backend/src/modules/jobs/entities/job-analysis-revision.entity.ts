import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { JobAnalysis } from '../../llm/interfaces/job-analysis.interface';
import { AnalysisStatus } from '../enums/analysis-status.enum';
import { Job } from './job.entity';

@Entity('job_analysis_revisions')
export class JobAnalysisRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  job_id: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column('uuid', { nullable: true })
  cv_revision_id: string | null;

  @Column('int', { nullable: true })
  cv_revision: number | null;

  @Column({
    type: 'enum',
    enum: AnalysisStatus,
    enumName: 'analysis_status_enum',
  })
  status: AnalysisStatus;

  @Column('jsonb', { nullable: true })
  result: JobAnalysis | null;

  @Column('int', { nullable: true })
  score: number | null;

  @Column('text', { nullable: true })
  recommendation: string | null;

  @Column('text', { nullable: true })
  error: string | null;

  @Column('text', { nullable: true })
  model: string | null;

  @Column('text', { nullable: true })
  prompt_version: string | null;

  @Column({ type: 'timestamptz' })
  analyzed_at: Date;
}
