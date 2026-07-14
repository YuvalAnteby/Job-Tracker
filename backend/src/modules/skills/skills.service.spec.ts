import { Repository } from 'typeorm';
import { JobRequirement } from '../jobs/entities/job-requirement.entity';
import { Job } from '../jobs/entities/job.entity';
import { Domain } from '../jobs/enums/domain.enum';
import { MetStatus } from '../jobs/enums/met-status.enum';
import { SkillAlias } from './entities/skill-alias.entity';
import { Skill } from './entities/skill.entity';
import {
  Actionability,
  Effort,
  GapType,
  RequirementPriority,
} from './skill-taxonomy';
import { SkillsService } from './skills.service';

describe('SkillsService', () => {
  it('deduplicates similar roles while retaining evidence', async () => {
    const skill = { id: 'skill-1', name: 'Kafka' } as Skill;
    const requirement = {
      name: 'Kafka',
      skill,
      priority: RequirementPriority.REQUIRED,
      gap_type: GapType.SKILL,
      actionability: Actionability.HIGH,
      effort: Effort.MEDIUM,
      met_status: MetStatus.NOT_MET,
      job_description_excerpt: 'Kafka required',
      cv_evidence: null,
    } as JobRequirement;
    const jobs = ['one', 'two'].map(
      (id) =>
        ({
          id,
          company_name: 'Acme',
          title: 'Backend Engineer',
          domain: Domain.BACKEND,
          llm_domain: Domain.BACKEND,
          include_in_gap: true,
          requirements: [requirement],
        }) as Job,
    );
    const service = new SkillsService(
      {} as Repository<Skill>,
      {} as Repository<SkillAlias>,
      {} as Repository<JobRequirement>,
      { find: jest.fn().mockResolvedValue(jobs) } as unknown as Repository<Job>,
    );

    const result = await service.getMatrix();

    expect(result).toEqual(
      expect.objectContaining({
        raw_job_count: 2,
        sample_size: 1,
        skills: [expect.objectContaining({ required_count: 1, gap_count: 1 })],
      }),
    );
  });
});
