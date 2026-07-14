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

  @Column('boolean')
  llm_is_applicable: boolean;

  @Column('boolean', { nullable: true })
  is_applicable_override: boolean | null;

  @Column('boolean', { default: true })
  is_interesting: boolean;

  @Column('boolean', { nullable: true })
  is_interesting_override: boolean | null;

  @Column({
    type: 'enum',
    enum: Domain,
  })
  llm_domain: Domain;

  @Column({
    type: 'enum',
    enum: Domain,
    nullable: true,
  })
  domain_override: Domain | null;

  @Column('text')
  llm_summary: string;

  @CreateDateColumn({ type: 'timestamptz' })
  added_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  posted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  applied_at: Date | null;

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
    return this.is_applicable_override ?? this.llm_is_applicable;
  }

  @Expose()
  get effective_domain(): Domain {
    return this.domain_override ?? this.llm_domain;
  }
}
