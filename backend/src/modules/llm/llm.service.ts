import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { GeminiProvider } from './providers/gemini.provider';
import {
  JobAnalysis,
  GapSummaryResult,
  JobSummaryInput,
  AnalysisEnvelope,
} from './interfaces/job-analysis.interface';
import {
  GAP_PROMPT_VERSION,
  JOB_PROMPT_VERSION,
} from './providers/gemini.provider';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly geminiProvider: GeminiProvider,
  ) {}

  async analyzeJob(
    jobDescription: string,
  ): Promise<AnalysisEnvelope<JobAnalysis>> {
    const providerName = await this.settingsService.get<string>(
      'llm_provider',
      'gemini',
    );
    const model = await this.settingsService.get<string>(
      'llm_model',
      'gemini-2.5-flash',
    );
    const cvText = await this.settingsService.getMasterCvText();

    if (!cvText) {
      this.logger.warn(
        'Master CV text is empty. Analysis might be inaccurate.',
      );
    }

    if (providerName === 'gemini') {
      return {
        data: await this.geminiProvider.analyzeJob(
          jobDescription,
          cvText,
          model,
        ),
        model,
        prompt_version: JOB_PROMPT_VERSION,
        analyzed_at: new Date(),
      };
    }

    // Add other providers here (Anthropic, OpenAI)

    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }

  async generateGapSummary(
    jobs: JobSummaryInput[],
  ): Promise<AnalysisEnvelope<GapSummaryResult>> {
    const providerName = await this.settingsService.get<string>(
      'llm_provider',
      'gemini',
    );
    const model = await this.settingsService.get<string>(
      'llm_model',
      'gemini-2.5-flash',
    );
    const cvText = await this.settingsService.getMasterCvText();

    if (!cvText) {
      throw new Error('Master CV text is empty. Cannot generate gap summary.');
    }

    if (providerName === 'gemini') {
      return {
        data: await this.geminiProvider.generateGapSummary(jobs, cvText, model),
        model,
        prompt_version: GAP_PROMPT_VERSION,
        analyzed_at: new Date(),
      };
    }

    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }

  async extractTextFromImage(base64Image: string): Promise<string> {
    const providerName = await this.settingsService.get<string>(
      'llm_provider',
      'gemini',
    );

    if (providerName === 'gemini') {
      return this.geminiProvider.extractTextFromImage(base64Image);
    }

    throw new Error(`Unsupported LLM provider for vision: ${providerName}`);
  }
}
