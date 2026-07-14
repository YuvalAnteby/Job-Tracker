import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { Domain } from '../../jobs/enums/domain.enum';
import { AnalysisStatus } from '../../jobs/enums/analysis-status.enum';
import type { GapSummaryResult } from '../../llm/interfaces/job-analysis.interface';

@Entity('gap_summaries')
export class GapSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  generated_at: Date;

  @Column({
    type: 'enum',
    enum: Domain,
    nullable: true,
  })
  domain_filter: Domain | null;

  @Column('jsonb', { nullable: true })
  summary: GapSummaryResult | null;

  @Column('int')
  job_count: number;

  @Column('jsonb', { default: () => "'[]'::jsonb" })
  job_ids: string[];

  @Column('int', { default: 0 })
  profile_revision: number;

  @Column('jsonb', { default: () => "'{}'::jsonb" })
  cohort_options: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: AnalysisStatus,
    enumName: 'analysis_status_enum',
    default: AnalysisStatus.COMPLETED,
  })
  analysis_status: AnalysisStatus;

  @Column('text', { nullable: true })
  analysis_error: string | null;

  @Column('text', { nullable: true })
  analysis_model: string | null;

  @Column('text', { nullable: true })
  prompt_version: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  analyzed_at: Date | null;
}
