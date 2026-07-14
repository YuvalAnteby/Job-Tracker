/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Repository, UpdateResult } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { JobStatus } from './enums/job-status.enum';
import { JobsService } from './jobs.service';
import { LlmService } from '../llm/llm.service';
import { SettingsService } from '../settings/settings.service';
import { Domain } from './enums/domain.enum';
import { MetStatus } from './enums/met-status.enum';
import { AnalysisStatus } from './enums/analysis-status.enum';

describe('JobsService', () => {
  const job = {
    id: 'job-1',
    status: JobStatus.ACTIVE,
    applied_at: null,
  } as Job;

  const makeService = (affected = 1) => {
    const execute = jest.fn<Promise<UpdateResult>, []>().mockResolvedValue({
      generatedMaps: [],
      raw: [],
      affected,
    });
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute,
    };
    const jobs = {
      createQueryBuilder: jest.fn().mockReturnValue(updateBuilder),
      findOne: jest.fn().mockResolvedValue({ ...job }),
      save: jest
        .fn()
        .mockImplementation((value: Job) => Promise.resolve(value)),
      softRemove: jest
        .fn()
        .mockImplementation((value: Job) => Promise.resolve(value)),
    } as unknown as Repository<Job>;
    const requirements = {} as Repository<JobRequirement>;
    const service = new JobsService(
      jobs,
      requirements,
      {} as LlmService,
      {} as SettingsService,
    );
    return { service, jobs, updateBuilder };
  };

  it('sets the first application timestamp atomically', async () => {
    const { service, jobs, updateBuilder } = makeService();
    await service.update('job-1', { status: JobStatus.APPLIED });

    expect(updateBuilder.set).toHaveBeenCalledWith({
      status: JobStatus.APPLIED,
      applied_at: expect.any(Function),
    });
    expect(jobs.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: JobStatus.ACTIVE,
      }),
    );
  });

  it('rejects applying a missing or deleted job', async () => {
    const { service } = makeService(0);
    await expect(
      service.update('missing', { status: JobStatus.APPLIED }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats repeated deletion as successful', async () => {
    const { service, jobs } = makeService();
    const deleted = { ...job, deleted_at: new Date() } as Job;
    jest.mocked(jobs.findOne).mockResolvedValue(deleted);

    await expect(service.remove(job.id)).resolves.toBe(deleted);
    expect(jobs.softRemove).not.toHaveBeenCalled();
  });

  it('reports per-job bulk failures', async () => {
    const { service } = makeService();
    jest
      .spyOn(service, 'remove')
      .mockResolvedValueOnce(job)
      .mockRejectedValueOnce(new NotFoundException('missing'));

    await expect(service.bulkRemove(['job-1', 'missing'])).resolves.toEqual({
      succeeded: ['job-1'],
      failed: [{ id: 'missing', error: 'missing' }],
    });
  });
});

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
