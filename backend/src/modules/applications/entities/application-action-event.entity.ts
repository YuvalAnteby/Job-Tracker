import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApplicationAction } from './application-action.entity';

export enum ApplicationActionEventType {
  SCHEDULED = 'SCHEDULED',
  RESCHEDULED = 'RESCHEDULED',
  COMPLETED = 'COMPLETED',
  DISMISSED = 'DISMISSED',
}

@Entity('application_action_events')
export class ApplicationActionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  action_id: string;

  @ManyToOne(() => ApplicationAction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'action_id' })
  action: ApplicationAction;

  @Column({ type: 'enum', enum: ApplicationActionEventType })
  event_type: ApplicationActionEventType;

  @Column('text')
  label: string;

  @Column({ type: 'timestamptz' })
  due_at: Date;

  @Column('int')
  revision: number;

  @CreateDateColumn({ type: 'timestamptz' })
  occurred_at: Date;
}
