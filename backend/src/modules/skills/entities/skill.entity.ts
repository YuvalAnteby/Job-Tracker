import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { SkillAlias } from './skill-alias.entity';

@Entity('skills')
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120, unique: true })
  name: string;

  @OneToMany(() => SkillAlias, (alias) => alias.skill)
  aliases: SkillAlias[];
}
