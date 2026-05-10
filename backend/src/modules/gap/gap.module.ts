import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GapSummary } from './entities/gap-summary.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GapSummary])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class GapModule {}
