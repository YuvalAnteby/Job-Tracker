import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { LlmModule } from '../llm/llm.module';
import { SettingsModule } from '../settings/settings.module';
import { ApplicationStageEvent } from './entities/application-stage-event.entity';
import { SkillsModule } from '../skills/skills.module';
import { JobAnalysisRevision } from './entities/job-analysis-revision.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      JobRequirement,
      ApplicationStageEvent,
      JobAnalysisRevision,
    ]),
    LlmModule,
    SettingsModule,
    SkillsModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService, TypeOrmModule],
})
export class JobsModule {}
