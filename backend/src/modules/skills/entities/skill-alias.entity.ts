import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Skill } from './skill.entity';

@Entity('skill_aliases')
export class SkillAlias {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160, unique: true })
  normalized_alias: string;

  @Column('uuid')
  skill_id: string;

  @ManyToOne(() => Skill, (skill) => skill.aliases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill: Skill;

  @Column('boolean', { default: false })
  is_manual: boolean;
}
