import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Job } from '../../jobs/entities/job.entity';
import { JobRequirement } from '../../jobs/entities/job-requirement.entity';
import { Skill } from '../../skills/entities/skill.entity';
import { GapType } from '../../skills/skill-taxonomy';
import { RoadmapStatus } from '../enums/roadmap-status.enum';
import { RoadmapHistory } from './roadmap-history.entity';
import { RoadmapProofArtifact } from './roadmap-proof-artifact.entity';

@Entity('roadmap_items')
export class RoadmapItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 180 }) title: string;
  @Column('text', { nullable: true }) notes: string | null;
  @Column('uuid', { nullable: true }) skill_id: string | null;
  @ManyToOne(() => Skill, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill | null;
  @Column({ type: 'varchar', length: 20, default: RoadmapStatus.PLANNED })
  status: RoadmapStatus;
  @Column({ type: 'varchar', length: 20, default: GapType.SKILL })
  gap_type: GapType;
  @Column({ type: 'date', nullable: true }) target_date: string | null;
  @Column('int') frequency: number;
  @Column('int') importance: number;
  @Column('int') relevance: number;
  @Column('int') evidence_weakness: number;
  @Column('int') effort: number;
  @Column({ type: 'double precision' }) recommended_priority: number;
  @Column({ type: 'double precision', nullable: true }) priority_override:
    | number
    | null;
  @Column('int', { nullable: true }) target_profile_revision: number | null;
  @Column('text', { nullable: true }) cv_evidence: string | null;
  @ManyToMany(() => Job)
  @JoinTable({
    name: 'roadmap_item_jobs',
    joinColumn: { name: 'roadmap_item_id' },
    inverseJoinColumn: { name: 'job_id' },
  })
  jobs: Job[];
  @ManyToMany(() => JobRequirement)
  @JoinTable({
    name: 'roadmap_item_requirements',
    joinColumn: { name: 'roadmap_item_id' },
    inverseJoinColumn: { name: 'requirement_id' },
  })
  requirements: JobRequirement[];
  @OneToMany(() => RoadmapProofArtifact, (artifact) => artifact.item)
  artifacts: RoadmapProofArtifact[];
  @OneToMany(() => RoadmapHistory, (history) => history.item)
  history: RoadmapHistory[];
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
