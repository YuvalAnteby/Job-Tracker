import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { Domain } from '../../jobs/enums/domain.enum';

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

  @Column('jsonb')
  summary: any; // Type defined in spec: JSONB shape

  @Column('int')
  job_count: number;
}
