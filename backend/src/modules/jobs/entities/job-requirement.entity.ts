import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Job } from './job.entity';
import { MetStatus } from '../enums/met-status.enum';

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

  @Column({
    type: 'enum',
    enum: MetStatus,
  })
  met_status: MetStatus;

  @Column('text')
  reasoning: string;

  @Column('int')
  order: number;
}
