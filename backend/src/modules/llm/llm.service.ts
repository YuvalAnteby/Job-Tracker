import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { GeminiProvider } from './providers/gemini.provider';
import {
  JobAnalysis,
  GapSummaryResult,
  JobSummaryInput,
} from './interfaces/job-analysis.interface';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly geminiProvider: GeminiProvider,
  ) {}

  async analyzeJob(jobDescription: string): Promise<JobAnalysis> {
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
      return this.geminiProvider.analyzeJob(jobDescription, cvText, model);
    }

    // Add other providers here (Anthropic, OpenAI)

    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }

  async generateGapSummary(jobs: JobSummaryInput[]): Promise<GapSummaryResult> {
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
      return this.geminiProvider.generateGapSummary(jobs, cvText, model);
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
