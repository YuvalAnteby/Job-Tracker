import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { CvSource } from '../dto/master-cv.dto';

@Entity('cv_revisions')
export class CvRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int', { unique: true })
  revision: number;

  @Column('text')
  content: string;

  @Column('text')
  ai_visible_text: string;

  @Column('text')
  source: CvSource;

  @Column('text', { nullable: true })
  filename: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
