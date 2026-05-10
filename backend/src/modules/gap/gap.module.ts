import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GapSummary } from './entities/gap-summary.entity';
import { Job } from '../jobs/entities/job.entity';
import { GapService } from './gap.service';
import { GapController } from './gap.controller';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [TypeOrmModule.forFeature([GapSummary, Job]), LlmModule],
  controllers: [GapController],
  providers: [GapService],
  exports: [GapService],
})
export class GapModule {}
