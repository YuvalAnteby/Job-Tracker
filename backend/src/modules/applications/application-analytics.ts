import { Job } from '../jobs/entities/job.entity';
import { ApplicationStage } from '../jobs/enums/application-stage.enum';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

interface CountRate {
  total: number;
  responses: number;
  response_rate: number | null;
}

export interface ApplicationAnalytics {
  sample_size: number;
  disclaimer: string;
  weekly_applications: { week: string; count: number }[];
  response_by_role: Record<string, CountRate>;
  response_by_source: Record<string, CountRate>;
  stage_conversion: Record<string, { count: number; rate: number | null }>;
  median_time_to_first_response_hours: number | null;
  rejection_reasons: Record<string, number>;
  outcomes_by_recommendation: Record<string, Record<string, number>>;
  outcomes_by_fit_band: Record<string, Record<string, number>>;
}

const increment = (counts: Record<string, number>, key: string): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const incrementOutcome = (
  groups: Record<string, Record<string, number>>,
  group: string,
  outcome: string,
): void => {
  groups[group] ??= {};
  increment(groups[group], outcome);
};

const weekStart = (date: Date): string => {
  const start = new Date(date);
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  return start.toISOString().slice(0, 10);
};

const fitBand = (score: number | null): string => {
  if (score === null) return 'Unknown';
  if (score >= 80) return '80-100';
  if (score >= 60) return '60-79';
  return '0-59';
};

export const calculateApplicationAnalytics = (
  jobs: Job[],
  filters: AnalyticsQueryDto = {},
): ApplicationAnalytics => {
  const applied = jobs.filter((job) => {
    if (!job.applied_at) return false;
    if (filters.from && job.applied_at < filters.from) return false;
    if (filters.to && job.applied_at > filters.to) return false;
    if (filters.domain && job.effective_domain !== filters.domain) return false;
    if (
      filters.classification &&
      job.effective_classification !== filters.classification
    )
      return false;
    const source =
      job.application_events.find(
        (event) => event.new_stage === ApplicationStage.APPLIED,
      )?.source ?? 'UNKNOWN';
    return !filters.source || source === filters.source;
  });
  const weekly: Record<string, number> = {};
  const role: Record<string, CountRate> = {};
  const source: Record<string, CountRate> = {};
  const stageCounts: Record<string, number> = {};
  const responseHours: number[] = [];
  const rejectionReasons: Record<string, number> = {};
  const recommendations: Record<string, Record<string, number>> = {};
  const fitBands: Record<string, Record<string, number>> = {};

  for (const job of applied) {
    increment(weekly, weekStart(job.applied_at!));
    const events = [...job.application_events].sort(
      (left, right) => left.occurred_at.getTime() - right.occurred_at.getTime(),
    );
    const applicationSource =
      events.find((event) => event.new_stage === ApplicationStage.APPLIED)
        ?.source ?? 'UNKNOWN';
    const response = events.find(
      (event) =>
        event.occurred_at >= job.applied_at! &&
        ![ApplicationStage.NOT_APPLIED, ApplicationStage.APPLIED].includes(
          event.new_stage,
        ),
    );
    for (const [key, bucket] of [
      [job.title, role],
      [applicationSource, source],
    ] as const) {
      bucket[key] ??= { total: 0, responses: 0, response_rate: null };
      bucket[key].total += 1;
      if (response) bucket[key].responses += 1;
    }
    const visited = new Set<ApplicationStage>([
      ApplicationStage.APPLIED,
      ...events.map((event) => event.new_stage),
    ]);
    for (const stage of visited) increment(stageCounts, stage);
    if (response) {
      responseHours.push(
        (response.occurred_at.getTime() - job.applied_at!.getTime()) /
          3_600_000,
      );
    }
    for (const event of events) {
      if (event.new_stage === ApplicationStage.REJECTED) {
        increment(rejectionReasons, event.rejection_reason || 'Unspecified');
      }
    }
    incrementOutcome(
      recommendations,
      job.recommendation ?? 'Unknown',
      job.application_stage,
    );
    incrementOutcome(
      fitBands,
      fitBand(job.effective_score),
      job.application_stage,
    );
  }

  for (const groups of [role, source]) {
    for (const value of Object.values(groups)) {
      value.response_rate = value.total
        ? Math.round((value.responses / value.total) * 1000) / 10
        : null;
    }
  }
  responseHours.sort((left, right) => left - right);
  const middle = Math.floor(responseHours.length / 2);
  const median = responseHours.length
    ? responseHours.length % 2
      ? responseHours[middle]
      : (responseHours[middle - 1] + responseHours[middle]) / 2
    : null;

  return {
    sample_size: applied.length,
    disclaimer:
      'Small samples are directional. These correlations do not establish causation.',
    weekly_applications: Object.entries(weekly)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([week, count]) => ({ week, count })),
    response_by_role: role,
    response_by_source: source,
    stage_conversion: Object.fromEntries(
      Object.values(ApplicationStage).map((stage) => [
        stage,
        {
          count: stageCounts[stage] ?? 0,
          rate: applied.length
            ? Math.round(((stageCounts[stage] ?? 0) / applied.length) * 1000) /
              10
            : null,
        },
      ]),
    ),
    median_time_to_first_response_hours:
      median === null ? null : Math.round(median * 10) / 10,
    rejection_reasons: rejectionReasons,
    outcomes_by_recommendation: recommendations,
    outcomes_by_fit_band: fitBands,
  };
};
