import { Repository } from 'typeorm';
import { GapService } from './gap.service';
import { GapSummary } from './entities/gap-summary.entity';
import { Job } from '../jobs/entities/job.entity';
import { LlmService } from '../llm/llm.service';
import { TelegramService } from '../telegram/telegram.service';
import { SettingsService } from '../settings/settings.service';
import { AnalysisClassification } from '../jobs/enums/analysis-classification.enum';
import { Domain } from '../jobs/enums/domain.enum';

describe('GapService cohort selection', () => {
  it('uses the same explainable cohort rules for preview', async () => {
    const jobs = [
      {
        id: 'target',
        include_in_gap: true,
        effective_domain: Domain.BACKEND,
        effective_classification: AnalysisClassification.TARGET,
      },
      {
        id: 'research',
        include_in_gap: true,
        effective_domain: Domain.BACKEND,
        effective_classification: AnalysisClassification.RESEARCH,
      },
      {
        id: 'irrelevant',
        include_in_gap: true,
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
