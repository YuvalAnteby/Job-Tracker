import { Domain } from '../jobs/enums/domain.enum';
import { MetStatus } from '../jobs/enums/met-status.enum';
import {
  GapSummaryResult,
  JobAnalysis,
  LlmRequirement,
  SCORE_DIMENSIONS,
  ScoreBreakdown,
} from './interfaces/job-analysis.interface';

export class InvalidLlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLlmOutputError';
  }
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidLlmOutputError('Expected a JSON object');
  }
  return value as Record<string, unknown>;
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InvalidLlmOutputError(`${field} must be a non-empty string`);
  }
  return value.trim();
};

const optionalText = (value: unknown, field: string): string | null =>
  value === null ? null : text(value, field);

const stringList = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value)) {
    throw new InvalidLlmOutputError(`${field} must be an array`);
  }
  return value.map((item, index) => text(item, `${field}[${index}]`));
};

const score = (value: unknown, field: string): number => {
  if (
    !Number.isInteger(value) ||
    (value as number) < 0 ||
    (value as number) > 100
  ) {
    throw new InvalidLlmOutputError(
      `${field} must be an integer from 0 through 100`,
    );
  }
  return value as number;
};

const enumValue = <T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
): T => {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new InvalidLlmOutputError(`${field} has an unrecognized value`);
  }
  return value as T;
};

const requirement = (value: unknown, index: number): LlmRequirement => {
  const item = record(value);
  const metStatus = enumValue(
    item.met_status,
    Object.values(MetStatus),
    `requirements[${index}].met_status`,
  );
  const excerpt = optionalText(
    item.job_description_excerpt,
    `requirements[${index}].job_description_excerpt`,
  );
  const evidence = optionalText(
    item.cv_evidence,
    `requirements[${index}].cv_evidence`,
  );
  const inferred = item.evidence_inferred;

  if (typeof inferred !== 'boolean') {
    throw new InvalidLlmOutputError(
      `requirements[${index}].evidence_inferred must be boolean`,
    );
  }
  if (metStatus !== MetStatus.MET && !excerpt) {
    throw new InvalidLlmOutputError(
      `requirements[${index}] needs a job-description excerpt`,
    );
  }
  if (metStatus === MetStatus.MET && !evidence && !inferred) {
    throw new InvalidLlmOutputError(
      `requirements[${index}] needs CV evidence or inferred evidence`,
    );
  }

  return {
    name: text(item.name, `requirements[${index}].name`),
    met_status: metStatus,
    reasoning: text(item.reasoning, `requirements[${index}].reasoning`),
    job_description_excerpt: excerpt,
    cv_evidence: evidence,
    evidence_inferred: inferred,
  };
};

export const parseJobAnalysis = (raw: string): JobAnalysis => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new InvalidLlmOutputError('Response was not valid JSON');
  }

  const data = record(value);
  if (!Array.isArray(data.requirements) || data.requirements.length === 0) {
    throw new InvalidLlmOutputError('requirements cannot be empty');
  }
  const dimensions = record(data.score_breakdown);
  const score_breakdown = Object.fromEntries(
    SCORE_DIMENSIONS.map((dimension) => [
      dimension,
      score(dimensions[dimension], `score_breakdown.${dimension}`),
    ]),
  ) as ScoreBreakdown;

  const requirements = data.requirements.map(requirement);
  const requirementNames = requirements.map((item) =>
    item.name.toLocaleLowerCase(),
  );
  if (new Set(requirementNames).size !== requirementNames.length) {
    throw new InvalidLlmOutputError('requirements contain duplicates');
  }

  return {
    company_name: text(data.company_name, 'company_name'),
    title: text(data.title, 'title'),
    domain: enumValue(data.domain, Object.values(Domain), 'domain'),
    summary: text(data.summary, 'summary'),
    score_breakdown,
    requirements,
  };
};

export const parseGapSummary = (raw: string): GapSummaryResult => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new InvalidLlmOutputError('Response was not valid JSON');
  }
  const data = record(value);
  const domains = record(data.domains);
  if (Object.keys(domains).length === 0) {
    throw new InvalidLlmOutputError('domains cannot be empty');
  }

  const parsedDomains = Object.fromEntries(
    Object.entries(domains).map(([domain, entry]) => {
      enumValue(domain, Object.values(Domain), `domains.${domain}`);
      const detail = record(entry);
      return [
        domain,
        {
          missing_skills: stringList(
            detail.missing_skills,
            `domains.${domain}.missing_skills`,
          ),
          partially_known: stringList(
            detail.partially_known,
            `domains.${domain}.partially_known`,
          ),
          gaps_detail: text(
            detail.gaps_detail,
            `domains.${domain}.gaps_detail`,
          ),
        },
      ];
    }),
  );
  const topGaps = stringList(data.overall_top_gaps, 'overall_top_gaps');
  if (topGaps.length === 0) {
    throw new InvalidLlmOutputError('overall_top_gaps cannot be empty');
  }

  return { domains: parsedDomains, overall_top_gaps: topGaps };
};
