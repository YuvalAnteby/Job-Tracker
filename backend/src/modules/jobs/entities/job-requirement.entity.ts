import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Job } from './job.entity';
import { MetStatus } from '../enums/met-status.enum';
import { Skill } from '../../skills/entities/skill.entity';
import {
  Actionability,
  Effort,
  GapType,
  RequirementPriority,
} from '../../skills/skill-taxonomy';

@Entity('job_requirements')
export class JobRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  job_id: string;

  @ManyToOne(() => Job, (job) => job.requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column('text')
  name: string;

  @Column('uuid', { nullable: true })
  skill_id: string | null;

  @ManyToOne(() => Skill, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: RequirementPriority.REQUIRED,
  })
  priority: RequirementPriority;

  @Column({ type: 'varchar', length: 20, default: GapType.SKILL })
  gap_type: GapType;

  @Column({ type: 'varchar', length: 20, default: Actionability.HIGH })
  actionability: Actionability;

  @Column({ type: 'varchar', length: 20, default: Effort.MEDIUM })
  effort: Effort;

  @Column({
    type: 'enum',
    enum: MetStatus,
  })
  met_status: MetStatus;

  @Column('text')
  reasoning: string;

  @Column('text', { nullable: true })
  job_description_excerpt: string | null;

  @Column('text', { nullable: true })
  cv_evidence: string | null;

  @Column('boolean', { default: false })
  evidence_inferred: boolean;

  @Column('int')
  order: number;
}
