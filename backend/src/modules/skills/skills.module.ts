import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobRequirement } from '../jobs/entities/job-requirement.entity';
import { Job } from '../jobs/entities/job.entity';
import { LlmModule } from '../llm/llm.module';
import { SkillAlias } from './entities/skill-alias.entity';
import { Skill } from './entities/skill.entity';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Skill, SkillAlias, JobRequirement, Job]),
    LlmModule,
  ],
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
