import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { LlmModule } from '../llm/llm.module';
import { SettingsModule } from '../settings/settings.module';
import { ApplicationStageEvent } from './entities/application-stage-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, JobRequirement, ApplicationStageEvent]),
    LlmModule,
    SettingsModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService, TypeOrmModule],
})
export class JobsModule {}
