import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RoadmapItem } from './roadmap-item.entity';

@Entity('roadmap_history')
export class RoadmapHistory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') item_id: string;
  @ManyToOne(() => RoadmapItem, (item) => item.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: RoadmapItem;
  @Column({ length: 40 }) event: string;
  @Column('jsonb', { default: {} }) details: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
