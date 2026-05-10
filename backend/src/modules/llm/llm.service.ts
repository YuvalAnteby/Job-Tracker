import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { GeminiProvider } from './providers/gemini.provider';
import { JobAnalysis } from './interfaces/job-analysis.interface';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly geminiProvider: GeminiProvider,
  ) {}

  async analyzeJob(jobDescription: string): Promise<JobAnalysis> {
    const providerName = await this.settingsService.get<string>('llm_provider', 'gemini');
    const model = await this.settingsService.get<string>('llm_model', 'gemini-2.5-flash');
    const cvText = await this.settingsService.get<string>('master_cv_cached_text', '');

    if (!cvText) {
      this.logger.warn('Master CV text is empty. Analysis might be inaccurate.');
    }

    if (providerName === 'gemini') {
      return this.geminiProvider.analyzeJob(jobDescription, cvText, model);
    }

    // Add other providers here (Anthropic, OpenAI)
    
    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }
}
