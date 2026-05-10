import { Domain } from '../../jobs/enums/domain.enum';
import { MetStatus } from '../../jobs/enums/met-status.enum';

export interface LlmRequirement {
  name: string;
  met_status: MetStatus;
  reasoning: string;
}

export interface JobAnalysis {
  score: number;
  domain: Domain;
  summary: string;
  requirements: LlmRequirement[];
}

export interface JobSummaryInput {
  title: string;
  company_name: string;
  domain: Domain;
  requirements: LlmRequirement[];
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
