import { Job } from '../jobs/entities/job.entity';
import { AnalysisClassification } from '../jobs/enums/analysis-classification.enum';
import { ApplicationStage } from '../jobs/enums/application-stage.enum';
import { Domain } from '../jobs/enums/domain.enum';
import { Recommendation } from '../jobs/enums/recommendation.enum';
import { calculateApplicationAnalytics } from './application-analytics';

const job = (input: {
  id: string;
  applied: string;
  title?: string;
  source?: string;
  response?: { stage: ApplicationStage; at: string; reason?: string };
  score?: number;
}): Job =>
  Object.assign(new Job(), {
    id: input.id,
    title: input.title ?? 'Backend Engineer',
    company_name: 'Acme',
    applied_at: new Date(input.applied),
    domain: Domain.BACKEND,
    llm_domain: Domain.BACKEND,
    domain_override: null,
    suggested_classification: AnalysisClassification.TARGET,
    classification_override: null,
    llm_score: input.score ?? 82,
    score_override: null,
    recommendation: Recommendation.APPLY,
    application_stage: input.response?.stage ?? ApplicationStage.APPLIED,
    application_events: [
      {
        id: `${input.id}-applied`,
        new_stage: ApplicationStage.APPLIED,
        previous_stage: ApplicationStage.NOT_APPLIED,
        occurred_at: new Date(input.applied),
        source: input.source ?? 'WEB',
        rejection_reason: null,
      },
      ...(input.response
        ? [
            {
              id: `${input.id}-response`,
              new_stage: input.response.stage,
              previous_stage: ApplicationStage.APPLIED,
              occurred_at: new Date(input.response.at),
              source: 'WEB',
              rejection_reason: input.response.reason ?? null,
            },
          ]
        : []),
    ],
  });

describe('calculateApplicationAnalytics', () => {
  it('derives known conversion, response timing, and rejection sequences', () => {
    const result = calculateApplicationAnalytics([
      job({
        id: 'one',
        applied: '2026-07-06T09:00:00Z',
        response: {
          stage: ApplicationStage.RECRUITER_SCREEN,
          at: '2026-07-07T09:00:00Z',
        },
      }),
      job({
        id: 'two',
        applied: '2026-07-08T09:00:00Z',
        source: 'TELEGRAM',
        score: 65,
        response: {
          stage: ApplicationStage.REJECTED,
          at: '2026-07-11T09:00:00Z',
          reason: 'Experience',
        },
      }),
      job({ id: 'three', applied: '2026-07-13T09:00:00Z' }),
    ]);

    expect(result.sample_size).toBe(3);
    expect(result.weekly_applications).toEqual([
      { week: '2026-07-06', count: 2 },
      { week: '2026-07-13', count: 1 },
    ]);
    expect(result.response_by_role['Backend Engineer'].response_rate).toBe(
      66.7,
    );
    expect(result.stage_conversion.RECRUITER_SCREEN.rate).toBe(33.3);
    expect(result.median_time_to_first_response_hours).toBe(48);
    expect(result.rejection_reasons.Experience).toBe(1);
    expect(result.outcomes_by_fit_band['60-79'].REJECTED).toBe(1);
  });

  it('filters by domain, classification, source, and date', () => {
    const result = calculateApplicationAnalytics(
      [job({ id: 'one', applied: '2026-07-06T09:00:00Z', source: 'WEB' })],
      {
        from: new Date('2026-07-01T00:00:00Z'),
        to: new Date('2026-07-31T23:59:59Z'),
        domain: Domain.BACKEND,
        classification: AnalysisClassification.TARGET,
        source: 'WEB',
      },
    );
    expect(result.sample_size).toBe(1);
  });
});
