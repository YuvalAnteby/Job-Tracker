import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Domain } from '../enums/domain.enum';
import { JobStatus } from '../enums/job-status.enum';
import { JobRequirement } from './job-requirement.entity';
import { Expose } from 'class-transformer';
import { AnalysisStatus } from '../enums/analysis-status.enum';
import { Recommendation } from '../enums/recommendation.enum';
import type { ScoreBreakdown } from '../../llm/interfaces/job-analysis.interface';
import { ApplicationStage } from '../enums/application-stage.enum';
import { ListingState } from '../enums/listing-state.enum';
import { UserDecision } from '../enums/user-decision.enum';
import { ApplicationStageEvent } from './application-stage-event.entity';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  company_name: string;

  @Column({ length: 255 })
  title: string;

  @Column('text')
  url: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: Domain,
  })
  domain: Domain;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.ACTIVE,
  })
  status: JobStatus;

  @Column('int', { nullable: true })
  llm_score: number | null;

  @Column('int', { nullable: true })
  score_override: number | null;

  @Column('boolean', { nullable: true })
  llm_is_applicable: boolean | null;

  @Column('boolean', { nullable: true })
  is_applicable_override: boolean | null;

  @Column('boolean', { default: true })
  is_interesting: boolean;

  @Column('boolean', { nullable: true })
  is_interesting_override: boolean | null;

  @Column({
    type: 'enum',
    enum: Domain,
    nullable: true,
  })
  llm_domain: Domain | null;

  @Column({
    type: 'enum',
    enum: Domain,
    nullable: true,
  })
  domain_override: Domain | null;

  @Column('text', { nullable: true })
  llm_summary: string | null;

  @Column('jsonb', { nullable: true })
  score_breakdown: ScoreBreakdown | null;

  @Column({
    type: 'enum',
    enum: Recommendation,
    enumName: 'recommendation_enum',
    nullable: true,
  })
  recommendation: Recommendation | null;

  @Column({
    type: 'enum',
    enum: AnalysisStatus,
    enumName: 'analysis_status_enum',
    default: AnalysisStatus.PENDING,
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

  @Column('uuid', { nullable: true })
  analysis_revision_id: string | null;

  @Column('uuid', { nullable: true })
  cv_revision_id: string | null;

  @Column('int', { nullable: true })
  cv_revision: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  added_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  posted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  applied_at: Date | null;

  @Column('uuid', { nullable: true })
  application_cv_revision_id: string | null;

  @Column({ type: 'enum', enum: ListingState, default: ListingState.OPEN })
  listing_state: ListingState;

  @Column({
    type: 'enum',
    enum: UserDecision,
    default: UserDecision.UNDECIDED,
  })
  user_decision: UserDecision;

  @Column({
    type: 'enum',
    enum: ApplicationStage,
    default: ApplicationStage.NOT_APPLIED,
  })
  application_stage: ApplicationStage;

  @Column('boolean', { default: true })
  include_in_gap: boolean;

  @Column('jsonb')
  posting_snapshot: Record<string, string | null>;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @OneToMany(() => JobRequirement, (requirement) => requirement.job, {
    cascade: true,
  })
  requirements: JobRequirement[];

  @OneToMany(() => ApplicationStageEvent, (event) => event.job)
  application_events: ApplicationStageEvent[];

  // Computed columns (virtual getters)
  @Expose()
  get effective_score(): number | null {
    return this.score_override ?? this.llm_score;
  }

  @Expose()
  get effective_is_applicable(): boolean {
    return this.is_applicable_override ?? this.llm_is_applicable ?? false;
  }

  @Expose()
  get effective_domain(): Domain {
    return this.domain_override ?? this.llm_domain ?? this.domain;
  }
}
