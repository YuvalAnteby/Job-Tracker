/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository, UpdateResult } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobRequirement } from './entities/job-requirement.entity';
import { JobStatus } from './enums/job-status.enum';
import { JobsService } from './jobs.service';
import { LlmService } from '../llm/llm.service';
import { SettingsService } from '../settings/settings.service';
import { Domain } from './enums/domain.enum';
import { MetStatus } from './enums/met-status.enum';
import { AnalysisStatus } from './enums/analysis-status.enum';
import { ApplicationStageEvent } from './entities/application-stage-event.entity';
import { ApplicationStage } from './enums/application-stage.enum';
import { SkillsService } from '../skills/skills.service';
import { JobAnalysisRevision } from './entities/job-analysis-revision.entity';

const analysisRevisions = {
  create: jest.fn(
    (value: Partial<JobAnalysisRevision>) => value as JobAnalysisRevision,
  ),
  save: jest.fn((value: JobAnalysisRevision) =>
    Promise.resolve({
      id: 'analysis-1',
      ...value,
    }),
  ),
} as unknown as Repository<JobAnalysisRevision>;

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
      analysisRevisions,
      {} as LlmService,
      {} as SettingsService,
      {} as DataSource,
      {} as SkillsService,
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
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockImplementation(() => Promise.resolve(saved[0] ?? null)),
      create: jest.fn((value: Partial<Job>) => Object.assign(new Job(), value)),
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
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Job) return jobs;
        if (entity === JobRequirement) return requirements;
        return analysisRevisions;
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        (callback: (value: EntityManager) => Promise<unknown>) =>
          callback(manager),
      ),
    } as unknown as DataSource;
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
        cv_revision_id: 'cv-1',
        cv_revision: 1,
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
      analysisRevisions,
      llm as unknown as LlmService,
      settings as unknown as SettingsService,
      dataSource,
      {
        normalizeRequirements: jest.fn().mockResolvedValue([
          {
            skill_id: null,
            priority: 'REQUIRED',
            gap_type: 'SKILL',
            actionability: 'HIGH',
            effort: 'MEDIUM',
          },
        ]),
      } as unknown as SkillsService,
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
    expect(
      service['skillsService'].normalizeRequirements,
    ).toHaveBeenCalledTimes(1);
  });

  it('rolls back replacement requirements and persists terminal failure', async () => {
    const previousRequirement = {
      id: 'requirement-old',
      job_id: 'job-1',
      name: 'Existing requirement',
    } as JobRequirement;
    const state = {
      requirements: [previousRequirement],
      revisions: [] as JobAnalysisRevision[],
    };
    const job = {
      id: 'job-1',
      company_name: 'Acme',
      title: 'Engineer',
      description: 'TypeScript role',
      requirements: [previousRequirement],
      deleted_at: null,
      cv_revision_id: 'cv-old',
      cv_revision: 1,
    } as Job;
    const jobs = {
      findOne: jest.fn().mockResolvedValue(job),
      save: jest
        .fn()
        .mockRejectedValueOnce(new Error('job write failed'))
        .mockImplementation((value: Partial<Job>) => {
          Object.assign(job, value);
          return Promise.resolve(job);
        }),
    };
    const requirements = {
      create: jest.fn(
        (value: Partial<JobRequirement>) => value as JobRequirement,
      ),
      delete: jest.fn(() => {
        state.requirements.length = 0;
        return Promise.resolve({ affected: 1, raw: [] });
      }),
    };
    const revisions = {
      create: jest.fn(
        (value: Partial<JobAnalysisRevision>) => value as JobAnalysisRevision,
      ),
      save: jest.fn((value: JobAnalysisRevision) => {
        const revision = {
          ...value,
          id: `revision-${state.revisions.length + 1}`,
        };
        state.revisions.push(revision);
        return Promise.resolve(revision);
      }),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Job) return jobs;
        if (entity === JobRequirement) return requirements;
        return revisions;
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        async (callback: (value: EntityManager) => Promise<unknown>) => {
          const previousRequirements = [...state.requirements];
          const previousRevisions = [...state.revisions];
          try {
            return await callback(manager);
          } catch (error: unknown) {
            state.requirements.splice(
              0,
              state.requirements.length,
              ...previousRequirements,
            );
            state.revisions.splice(
              0,
              state.revisions.length,
              ...previousRevisions,
            );
            throw error;
          }
        },
      ),
    } as unknown as DataSource;
    const service = new JobsService(
      jobs as unknown as Repository<Job>,
      requirements as unknown as Repository<JobRequirement>,
      revisions as unknown as Repository<JobAnalysisRevision>,
      {
        analyzeJob: jest.fn().mockResolvedValue({
          data: {
            company_name: 'Acme',
            title: 'Engineer',
            domain: Domain.BACKEND,
            summary: 'Strong fit.',
            score_breakdown: {
              hard_requirements: 80,
              preferred_requirements: 70,
              technical_stack: 80,
              seniority_eligibility: 90,
              domain_alignment: 80,
              logistics_availability: 90,
            },
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
          cv_revision_id: 'cv-1',
          cv_revision: 1,
        }),
      } as unknown as LlmService,
      {
        get: jest.fn((key: string) =>
          Promise.resolve(key === 'score_threshold' ? 70 : ['BACKEND']),
        ),
      } as unknown as SettingsService,
      dataSource,
      {
        normalizeRequirements: jest.fn().mockResolvedValue([
          {
            skill_id: null,
            priority: 'REQUIRED',
            gap_type: 'SKILL',
            actionability: 'HIGH',
            effort: 'MEDIUM',
          },
        ]),
      } as unknown as SkillsService,
    );

    const result = await service['processJobAnalysis'](
      job,
      job.description,
      job.company_name,
      job.title,
    );

    expect(result.analysis_status).toBe(AnalysisStatus.FAILED);
    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
    expect(state.requirements).toEqual([previousRequirement]);
    expect(state.revisions).toHaveLength(1);
    expect(state.revisions[0].status).toBe(AnalysisStatus.FAILED);
  });
});

describe('JobsService web enqueue', () => {
  const dimensions = {
    hard_requirements: 80,
    preferred_requirements: 70,
    technical_stack: 80,
    seniority_eligibility: 90,
    domain_alignment: 80,
    logistics_availability: 90,
  };
  const analysisResult = {
    data: {
      company_name: 'Acme',
      title: 'Engineer',
      domain: Domain.BACKEND,
      summary: 'Strong fit.',
      score_breakdown: dimensions,
      requirements: [],
    },
    model: 'gemini-test',
    prompt_version: 'job-analysis-v2',
    analyzed_at: new Date('2026-07-14T00:00:00Z'),
    cv_revision_id: 'cv-1',
    cv_revision: 1,
  };

  const flushImmediate = (): Promise<void> =>
    new Promise((resolve) => setImmediate(resolve));

  const makeService = (
    analyzeJob: jest.Mock,
  ): {
    service: JobsService;
    jobs: Repository<Job>;
    saved: Job[];
    currentJob: Job;
  } => {
    const pendingJob = {
      id: 'job-1',
      company_name: 'Acme',
      title: 'Engineer',
      description: 'TypeScript role',
      requirements: [],
      deleted_at: null,
    } as Job;
    const currentJob = { ...pendingJob, requirements: [] } as Job;
    const saved: Job[] = [];
    const jobs = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue(currentJob),
      create: jest.fn((value: Partial<Job>) => Object.assign(new Job(), value)),
      save: jest.fn((value: Job) => {
        value.id ??= 'job-1';
        if (saved.length > 0) Object.assign(currentJob, value);
        saved.push(value);
        return Promise.resolve(value);
      }),
    } as unknown as Repository<Job>;
    const requirements = {
      create: jest.fn(
        (value: Partial<JobRequirement>) => value as JobRequirement,
      ),
      delete: jest.fn().mockResolvedValue({ affected: 0, raw: [] }),
    } as unknown as Repository<JobRequirement>;
    const revisions = {
      create: jest.fn(
        (value: Partial<JobAnalysisRevision>) => value as JobAnalysisRevision,
      ),
      save: jest.fn((value: JobAnalysisRevision) =>
        Promise.resolve({ id: 'analysis-1', ...value }),
      ),
    } as unknown as Repository<JobAnalysisRevision>;
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Job) return jobs;
        if (entity === JobRequirement) return requirements;
        return revisions;
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        (callback: (value: EntityManager) => Promise<unknown>) =>
          callback(manager),
      ),
    } as unknown as DataSource;
    const service = new JobsService(
      jobs,
      requirements,
      revisions,
      { analyzeJob } as unknown as LlmService,
      {
        get: jest.fn((key: string) =>
          Promise.resolve(key === 'score_threshold' ? 70 : ['BACKEND']),
        ),
      } as unknown as SettingsService,
      dataSource,
      {
        normalizeRequirements: jest.fn().mockResolvedValue([]),
      } as unknown as SkillsService,
    );
    return { service, jobs, saved, currentJob };
  };

  it('returns a pending job before deferred analysis completes and persists success', async () => {
    let resolveAnalysis: (value: typeof analysisResult) => void = () =>
      undefined;
    const analysisPromise = new Promise<typeof analysisResult>((resolve) => {
      resolveAnalysis = resolve;
    });
    const analyzeJob = jest.fn().mockReturnValue(analysisPromise);
    const { service, saved } = makeService(analyzeJob);

    const pending = await service.enqueue({
      company_name: 'Acme',
      title: 'Engineer',
      url: 'https://example.com/job',
      description: 'TypeScript role',
    });

    expect(pending.analysis_status).toBe(AnalysisStatus.PENDING);
    expect(analyzeJob).not.toHaveBeenCalled();

    await flushImmediate();
    expect(analyzeJob).toHaveBeenCalledTimes(1);
    resolveAnalysis(analysisResult);
    await flushImmediate();

    expect(saved.at(-1)).toMatchObject({
      analysis_status: AnalysisStatus.COMPLETED,
      llm_score: 82,
    });
  });

  it('keeps user edits made while deferred analysis is pending', async () => {
    let resolveAnalysis: (value: typeof analysisResult) => void = () =>
      undefined;
    const analysisPromise = new Promise<typeof analysisResult>((resolve) => {
      resolveAnalysis = resolve;
    });
    const analyzeJob = jest.fn().mockReturnValue(analysisPromise);
    const { service, saved, currentJob } = makeService(analyzeJob);

    await service.enqueue({
      company_name: 'Acme',
      title: 'Engineer',
      url: 'https://example.com/job',
      description: 'TypeScript role',
    });

    await flushImmediate();
    currentJob.notes = 'User edit';
    currentJob.score_override = 99;
    resolveAnalysis(analysisResult);
    await flushImmediate();

    expect(currentJob).toMatchObject({
      notes: 'User edit',
      score_override: 99,
      analysis_status: AnalysisStatus.COMPLETED,
    });
    expect(saved.at(-1)).not.toHaveProperty('notes');
    expect(saved.at(-1)).not.toHaveProperty('score_override');
  });

  it('skips deferred persistence when the job is deleted while analysis is pending', async () => {
    let resolveAnalysis: (value: typeof analysisResult) => void = () =>
      undefined;
    const analysisPromise = new Promise<typeof analysisResult>((resolve) => {
      resolveAnalysis = resolve;
    });
    const analyzeJob = jest.fn().mockReturnValue(analysisPromise);
    const { service, saved, currentJob } = makeService(analyzeJob);

    await service.enqueue({
      company_name: 'Acme',
      title: 'Engineer',
      url: 'https://example.com/job',
      description: 'TypeScript role',
    });

    await flushImmediate();
    currentJob.deleted_at = new Date();
    resolveAnalysis(analysisResult);
    await flushImmediate();

    expect(saved).toHaveLength(1);
  });

  it('persists a terminal failure after deferred analysis rejects', async () => {
    let rejectAnalysis: (reason?: unknown) => void = () => undefined;
    const analysisPromise = new Promise<typeof analysisResult>(
      (_resolve, reject) => {
        rejectAnalysis = reject;
      },
    );
    const analyzeJob = jest.fn().mockReturnValue(analysisPromise);
    const { service, saved } = makeService(analyzeJob);

    await service.enqueue({
      company_name: 'Acme',
      title: 'Engineer',
      url: 'https://example.com/job',
      description: 'TypeScript role',
    });

    await flushImmediate();
    rejectAnalysis(new Error('provider down'));
    await flushImmediate();

    expect(saved.at(-1)).toMatchObject({
      analysis_status: AnalysisStatus.FAILED,
      analysis_error: 'AI provider request failed',
    });
  });
});

describe('JobsService application pipeline', () => {
  const job = {
    id: 'job-1',
    application_stage: ApplicationStage.NOT_APPLIED,
    applied_at: null,
  } as Job;
  const returnedJob = { ...job, application_events: [] } as Job;
  const jobs = {
    findOne: jest.fn().mockResolvedValue(job),
    save: jest.fn().mockResolvedValue(job),
    findOneOrFail: jest.fn().mockResolvedValue(returnedJob),
  };
  const events = {
    create: jest.fn((value: ApplicationStageEvent) => value),
    save: jest
      .fn()
      .mockImplementation((value: ApplicationStageEvent) =>
        Promise.resolve(value),
      ),
  };
  const manager = {
    getRepository: jest.fn(
      (entity: typeof Job | typeof ApplicationStageEvent) =>
        entity === Job ? jobs : events,
    ),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn(
      (callback: (entityManager: EntityManager) => Promise<Job>) =>
        callback(manager),
    ),
  } as unknown as DataSource;
  const service = new JobsService(
    {} as Repository<Job>,
    {} as Repository<JobRequirement>,
    analysisRevisions,
    {} as LlmService,
    {
      getMasterCvContext: jest.fn().mockResolvedValue({ id: 'cv-1' }),
    } as unknown as SettingsService,
    dataSource,
    {} as SkillsService,
  );

  beforeEach(() => {
    job.application_stage = ApplicationStage.NOT_APPLIED;
    job.applied_at = null;
    jest.clearAllMocks();
  });

  it('appends an event and preserves the first applied date', async () => {
    const occurredAt = new Date('2026-07-14T08:00:00Z');
    await service.transitionApplicationStage('job-1', {
      new_stage: ApplicationStage.APPLIED,
      occurred_at: occurredAt,
      source: 'TELEGRAM',
    });

    expect(events.save).toHaveBeenCalledWith(
      expect.objectContaining({
        previous_stage: ApplicationStage.NOT_APPLIED,
        new_stage: ApplicationStage.APPLIED,
        source: 'TELEGRAM',
      }),
    );
    expect(job.applied_at).toEqual(occurredAt);
  });

  it('rejects invalid stage jumps without writing history', async () => {
    await expect(
      service.transitionApplicationStage('job-1', {
        new_stage: ApplicationStage.OFFER,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(events.save).not.toHaveBeenCalled();
  });
});
