/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';
import { GapService } from './gap.service';
import { GapSummary } from './entities/gap-summary.entity';
import { Job } from '../jobs/entities/job.entity';
import { LlmService } from '../llm/llm.service';
import { TelegramService } from '../telegram/telegram.service';
import { SettingsService } from '../settings/settings.service';
import { AnalysisClassification } from '../jobs/enums/analysis-classification.enum';
import { AnalysisStatus } from '../jobs/enums/analysis-status.enum';
import { Domain } from '../jobs/enums/domain.enum';
import type {
  AnalysisEnvelope,
  GapSummaryResult,
} from '../llm/interfaces/job-analysis.interface';

describe('GapService cohort selection', () => {
  it('uses the same explainable cohort rules for preview', async () => {
    const jobs = [
      {
        id: 'target',
        include_in_gap: true,
        analysis_status: AnalysisStatus.COMPLETED,
        effective_domain: Domain.BACKEND,
        effective_classification: AnalysisClassification.TARGET,
      },
      {
        id: 'research',
        include_in_gap: true,
        analysis_status: AnalysisStatus.COMPLETED,
        effective_domain: Domain.BACKEND,
        effective_classification: AnalysisClassification.RESEARCH,
      },
      {
        id: 'irrelevant',
        include_in_gap: true,
        analysis_status: AnalysisStatus.COMPLETED,
        effective_domain: Domain.BACKEND,
        effective_classification: AnalysisClassification.IRRELEVANT,
      },
    ] as Job[];
    const service = new GapService(
      {} as Repository<GapSummary>,
      { find: jest.fn().mockResolvedValue(jobs) } as unknown as Repository<Job>,
      {} as LlmService,
      {} as TelegramService,
      {
        getTargetProfile: jest.fn().mockResolvedValue({ revision: 4 }),
      } as unknown as SettingsService,
    );

    await expect(service.preview()).resolves.toEqual({
      included_job_ids: ['target'],
      excluded: [
        { id: 'research', reason: 'Research jobs require opt-in' },
        { id: 'irrelevant', reason: 'Classified as irrelevant' },
      ],
      profile_revision: 4,
      options: { domain_filter: null, include_research: false },
    });
    await expect(
      service.preview({ include_research: true }),
    ).resolves.toMatchObject({ included_job_ids: ['target', 'research'] });
  });
});

describe('GapService background generation', () => {
  const summaryResult: AnalysisEnvelope<GapSummaryResult> = {
    data: {
      domains: {
        [Domain.BACKEND]: {
          missing_skills: ['Kafka'],
          partially_known: [],
          gaps_detail: 'Needs practice',
        },
      },
      overall_top_gaps: ['Kafka'],
    },
    model: 'test-model',
    prompt_version: 'test-prompt',
    analyzed_at: new Date('2026-09-30T00:00:00Z'),
    cv_revision_id: 'cv-1',
    cv_revision: 1,
  };

  const flushImmediate = (): Promise<void> =>
    new Promise((resolve) => setImmediate(resolve));

  const makeService = (
    broadcastMessage: jest.Mock = jest.fn().mockResolvedValue(undefined),
  ): {
    service: GapService;
    repository: Repository<GapSummary>;
    llmService: LlmService;
    run: GapSummary;
  } => {
    const run = {
      id: 'run-1',
      generated_at: new Date('2026-09-30T00:00:00Z'),
    } as GapSummary;
    const repository = {
      create: jest.fn(
        (value: Partial<GapSummary>): GapSummary => Object.assign(run, value),
      ),
      save: jest.fn(
        (value: GapSummary): Promise<GapSummary> => Promise.resolve(value),
      ),
      update: jest.fn(
        (_id: string, value: Partial<GapSummary>): Promise<void> => {
          Object.assign(run, value);
          return Promise.resolve();
        },
      ),
    } as unknown as Repository<GapSummary>;
    const llmService = {
      generateGapSummary: jest.fn().mockResolvedValue(summaryResult),
    } as unknown as LlmService;
    const service = new GapService(
      repository,
      {
        find: jest.fn().mockResolvedValue([
          {
            id: 'job-1',
            include_in_gap: true,
            analysis_status: AnalysisStatus.COMPLETED,
            title: 'Backend Engineer',
            company_name: 'Acme',
            effective_domain: Domain.BACKEND,
            effective_classification: AnalysisClassification.TARGET,
            requirements: [],
            analysis_revision_id: 'analysis-1',
          } as Job,
        ]),
      } as unknown as Repository<Job>,
      llmService,
      { broadcastMessage } as unknown as TelegramService,
      {
        getTargetProfile: jest.fn().mockResolvedValue({ revision: 4 }),
      } as unknown as SettingsService,
    );
    return { service, repository, llmService, run };
  };

  it('returns the persisted pending run before deferred LLM work starts', async () => {
    const { service, repository, llmService, run } = makeService();

    const response = await service.generate();

    expect(response.run).toBe(run);
    expect(run).toMatchObject({
      id: 'run-1',
      analysis_status: AnalysisStatus.PENDING,
    });
    expect(llmService.generateGapSummary).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);

    await flushImmediate();

    expect(llmService.generateGapSummary).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ analysis_status: AnalysisStatus.COMPLETED }),
    );
    expect(run.analysis_status).toBe(AnalysisStatus.COMPLETED);
  });

  it('keeps a completed run when Telegram notification fails', async () => {
    const broadcastMessage = jest
      .fn()
      .mockRejectedValue(new Error('telegram unavailable'));
    const { service, repository, run } = makeService(broadcastMessage);

    await service.generate();
    await flushImmediate();

    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ analysis_status: AnalysisStatus.COMPLETED }),
    );
    expect(run.analysis_status).toBe(AnalysisStatus.COMPLETED);
  });

  it('updates the same run to failed when deferred analysis rejects', async () => {
    const { service, repository, llmService, run } = makeService();
    jest
      .mocked(llmService.generateGapSummary)
      .mockRejectedValue(new Error('provider down'));

    await service.generate();
    await flushImmediate();

    expect(repository.update).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        analysis_status: AnalysisStatus.FAILED,
        analysis_error: 'AI provider request failed',
      }),
    );
    expect(run.analysis_status).toBe(AnalysisStatus.FAILED);
  });
});

describe('GapService status lookup', () => {
  it('looks up the newest run for the normalized cohort', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const service = new GapService(
      { findOne } as unknown as Repository<GapSummary>,
      {} as Repository<Job>,
      {} as LlmService,
      {} as TelegramService,
      {} as SettingsService,
    );

    await service.getStatus({
      domain_filter: Domain.BACKEND,
      include_research: false,
    });

    expect(findOne).toHaveBeenCalledWith({
      where: {
        domain_filter: Domain.BACKEND,
        cohort_options: expect.objectContaining({
          _type: 'jsonContains',
          _value: {
            domain_filter: Domain.BACKEND,
            include_research: false,
          },
        }),
      },
      order: { generated_at: 'DESC' },
    });
  });
});
