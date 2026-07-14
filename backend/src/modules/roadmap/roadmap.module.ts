import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { JobRequirement } from '../jobs/entities/job-requirement.entity';
import { SettingsModule } from '../settings/settings.module';
import { Skill } from '../skills/entities/skill.entity';
import { RoadmapHistory } from './entities/roadmap-history.entity';
import { RoadmapItem } from './entities/roadmap-item.entity';
import { RoadmapProofArtifact } from './entities/roadmap-proof-artifact.entity';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoadmapItem,
      RoadmapHistory,
      RoadmapProofArtifact,
      Skill,
      Job,
      JobRequirement,
    ]),
    SettingsModule,
  ],
  controllers: [RoadmapController],
  providers: [RoadmapService],
})
export class RoadmapModule {}
