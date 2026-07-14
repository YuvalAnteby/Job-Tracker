import { Domain } from '../../jobs/enums/domain.enum';
import { MetStatus } from '../../jobs/enums/met-status.enum';
export { AnalysisStatus } from '../../jobs/enums/analysis-status.enum';
export { Recommendation } from '../../jobs/enums/recommendation.enum';

export interface LlmRequirement {
  name: string;
  met_status: MetStatus;
  reasoning: string;
  job_description_excerpt: string | null;
  cv_evidence: string | null;
  evidence_inferred: boolean;
}

export const SCORE_DIMENSIONS = [
  'hard_requirements',
  'preferred_requirements',
  'technical_stack',
  'seniority_eligibility',
  'domain_alignment',
  'logistics_availability',
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];
export type ScoreBreakdown = Record<ScoreDimension, number>;

export interface JobAnalysis {
  domain: Domain;
  summary: string;
  score_breakdown: ScoreBreakdown;
  requirements: LlmRequirement[];
  company_name?: string;
  title?: string;
}

export interface AnalysisEnvelope<T> {
  data: T;
  model: string;
  prompt_version: string;
  analyzed_at: Date;
  cv_revision_id: string | null;
  cv_revision: number | null;
}

export interface JobSummaryInput {
  title: string;
  company_name: string;
  domain: Domain;
  requirements: Pick<LlmRequirement, 'name' | 'met_status' | 'reasoning'>[];
}

export interface GapSummaryResult {
  domains: Record<
    string,
    {
      missing_skills: string[];
      partially_known: string[];
      gaps_detail: string;
    }
  >;
  overall_top_gaps: string[];
}
