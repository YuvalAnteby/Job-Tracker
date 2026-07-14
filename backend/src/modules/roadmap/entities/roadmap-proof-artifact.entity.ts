import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RoadmapItem } from './roadmap-item.entity';

@Entity('roadmap_proof_artifacts')
export class RoadmapProofArtifact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') item_id: string;
  @ManyToOne(() => RoadmapItem, (item) => item.artifacts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'item_id' })
  item: RoadmapItem;
  @Column({ length: 180 }) title: string;
  @Column('text', { nullable: true }) url: string | null;
  @Column('text', { nullable: true }) repository_url: string | null;
  @Column('text', { nullable: true }) notes: string | null;
  @Column('text', { nullable: true }) resources: string | null;
  @Column({ type: 'timestamptz', nullable: true }) promoted_at: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
