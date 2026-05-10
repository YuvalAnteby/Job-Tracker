import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryColumn({ length: 100 })
  key: string;

  @Column('jsonb')
  value: any;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
