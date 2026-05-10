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
