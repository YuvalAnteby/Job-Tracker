import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GapSummary } from './entities/gap-summary.entity';
import { Job } from '../jobs/entities/job.entity';
import { GapService } from './gap.service';
import { GapController } from './gap.controller';
import { LlmModule } from '../llm/llm.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GapSummary, Job]),
    LlmModule,
    forwardRef(() => TelegramModule),
  ],
  controllers: [GapController],
  providers: [GapService],
  exports: [GapService],
})
export class GapModule {}
