import {
  JobAnalysis,
  GapSummaryResult,
  JobSummaryInput,
} from './interfaces/job-analysis.interface';

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
}
