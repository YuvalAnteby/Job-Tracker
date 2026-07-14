import { Repository } from 'typeorm';
import { JobsService } from './jobs.service';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { LlmService } from '../llm/llm.service';
import { SettingsService } from '../settings/settings.service';
import { Domain } from './enums/domain.enum';
import { MetStatus } from './enums/met-status.enum';
import { AnalysisStatus } from './enums/analysis-status.enum';

describe('JobsService analysis persistence', () => {
  it('persists the validated score breakdown and evidence', async () => {
    const saved: Job[] = [];
    const jobs = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: Partial<Job>) => value as Job),
      save: jest.fn((job: Job) => {
        job.id ??= 'job-1';
        saved.push(job);
        return Promise.resolve(job);
      }),
    };
    const requirements = {
      create: jest.fn(
        (value: Partial<JobRequirement>) => value as JobRequirement,
      ),
      delete: jest.fn().mockResolvedValue({ affected: 0, raw: [] }),
    };
    const dimensions = {
      hard_requirements: 80,
      preferred_requirements: 70,
      technical_stack: 80,
      seniority_eligibility: 90,
      domain_alignment: 80,
      logistics_availability: 90,
    };
    const llm = {
      analyzeJob: jest.fn().mockResolvedValue({
        data: {
          company_name: 'Acme',
          title: 'Engineer',
          domain: Domain.BACKEND,
          summary: 'Strong fit.',
          score_breakdown: dimensions,
          requirements: [
            {
              name: 'TypeScript',
              met_status: MetStatus.MET,
              reasoning: 'Used professionally.',
              job_description_excerpt: null,
              cv_evidence: 'Built TypeScript services.',
              evidence_inferred: false,
            },
          ],
        },
        model: 'gemini-test',
        prompt_version: 'job-analysis-v2',
        analyzed_at: new Date('2026-07-14T00:00:00Z'),
      }),
    };
    const settings = {
      get: jest.fn((key: string) =>
        Promise.resolve(key === 'score_threshold' ? 70 : ['BACKEND']),
      ),
    };
    const service = new JobsService(
      jobs as unknown as Repository<Job>,
      requirements as unknown as Repository<JobRequirement>,
      llm as unknown as LlmService,
      settings as unknown as SettingsService,
    );

    const result = await service.create({
      company_name: 'skip',
      title: 'skip',
      url: 'https://example.com/job',
      description: 'TypeScript role',
    });

    expect(saved).toHaveLength(2);
    expect(result).toMatchObject({
      analysis_status: AnalysisStatus.COMPLETED,
      llm_score: 82,
      score_breakdown: dimensions,
      analysis_model: 'gemini-test',
    });
    expect(result.requirements[0].cv_evidence).toBe(
      'Built TypeScript services.',
    );
  });
});
