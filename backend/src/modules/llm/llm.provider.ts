import { JobAnalysis } from './interfaces/job-analysis.interface';

export abstract class LlmProvider {
  abstract analyzeJob(
    jobDescription: string,
    cvText: string,
    model?: string,
  ): Promise<JobAnalysis>;
}
