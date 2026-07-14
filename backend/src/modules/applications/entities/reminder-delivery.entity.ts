import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApplicationAction } from './application-action.entity';

export enum ReminderDeliveryStatus {
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Entity('reminder_deliveries')
@Unique(['action_id', 'action_revision', 'chat_id'])
export class ReminderDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  action_id: string;

  @ManyToOne(() => ApplicationAction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'action_id' })
  action: ApplicationAction;

  @Column('int')
  action_revision: number;

  @Column('text')
  chat_id: string;

  @Column({ type: 'enum', enum: ReminderDeliveryStatus })
  status: ReminderDeliveryStatus;

  @Column('int', { default: 0 })
  attempts: number;

  @Column('text', { nullable: true })
  last_error: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  attempted_at: Date;
}
