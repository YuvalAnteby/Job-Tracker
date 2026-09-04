import {
  JobAnalysis,
  GapSummaryResult,
  JobSummaryInput,
} from './interfaces/job-analysis.interface';
import { TaxonomyDecision } from './interfaces/skill-taxonomy.interface';

export abstract class LlmProvider {
  abstract analyzeJob(
    jobDescription: string,
    cvText: string,
    model?: string,
  ): Promise<JobAnalysis>;

  abstract generateGapSummary(
    jobs: JobSummaryInput[],
    cvText: string,
    model?: string,
  ): Promise<GapSummaryResult>;

  abstract classifySkillTerms(
    terms: string[],
    model?: string,
  ): Promise<TaxonomyDecision[]>;
}
