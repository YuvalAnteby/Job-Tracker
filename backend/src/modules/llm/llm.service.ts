import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import {
  JobAnalysis,
  GapSummaryResult,
  JobSummaryInput,
  AnalysisEnvelope,
} from './interfaces/job-analysis.interface';
import { TaxonomyDecision } from './interfaces/skill-taxonomy.interface';
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
    private readonly ollamaProvider: OllamaProvider,
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
      'gemini-3.7-flash',
    );
    const cv = await this.settingsService.getMasterCvContext();
    const cvText = cv.text;

    if (!cvText) {
      this.logger.warn(
        'Master CV text is empty. Analysis might be inaccurate.',
      );
    }

    if (providerName === 'ollama') {
      return {
        data: await this.ollamaProvider.analyzeJob(jobDescription, cvText),
        model: `ollama:${this.ollamaProvider.getModel()}`,
        prompt_version: `${JOB_PROMPT_VERSION}-ollama`,
        analyzed_at: new Date(),
        cv_revision_id: cv.id,
        cv_revision: cv.revision,
      };
    }

    if (providerName === 'gemini') {
      try {
        return {
          data: await this.geminiProvider.analyzeJob(
            jobDescription,
            cvText,
            model,
          ),
          model,
          prompt_version: JOB_PROMPT_VERSION,
          analyzed_at: new Date(),
          cv_revision_id: cv.id,
          cv_revision: cv.revision,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Gemini job analysis failed; trying Ollama fallback: ${message}`,
        );
        return {
          data: await this.ollamaProvider.analyzeJob(jobDescription, cvText),
          model: `ollama:${this.ollamaProvider.getModel()}`,
          prompt_version: `${JOB_PROMPT_VERSION}-ollama`,
          analyzed_at: new Date(),
          cv_revision_id: cv.id,
          cv_revision: cv.revision,
        };
      }
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
      'gemini-3.7-flash',
    );
    const cv = await this.settingsService.getMasterCvContext();
    const cvText = cv.text;

    if (!cvText) {
      throw new Error('Master CV text is empty. Cannot generate gap summary.');
    }

    if (providerName === 'ollama') {
      return {
        data: await this.ollamaProvider.generateGapSummary(jobs, cvText),
        model: `ollama:${this.ollamaProvider.getModel()}`,
        prompt_version: `${GAP_PROMPT_VERSION}-ollama`,
        analyzed_at: new Date(),
        cv_revision_id: cv.id,
        cv_revision: cv.revision,
      };
    }

    if (providerName === 'gemini') {
      try {
        return {
          data: await this.geminiProvider.generateGapSummary(
            jobs,
            cvText,
            model,
          ),
          model,
          prompt_version: GAP_PROMPT_VERSION,
          analyzed_at: new Date(),
          cv_revision_id: cv.id,
          cv_revision: cv.revision,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Gemini gap summary failed; trying Ollama fallback: ${message}`,
        );
        return {
          data: await this.ollamaProvider.generateGapSummary(jobs, cvText),
          model: `ollama:${this.ollamaProvider.getModel()}`,
          prompt_version: `${GAP_PROMPT_VERSION}-ollama`,
          analyzed_at: new Date(),
          cv_revision_id: cv.id,
          cv_revision: cv.revision,
        };
      }
    }

    throw new Error(`Unsupported LLM provider: ${providerName}`);
  }

  async classifySkillTerms(terms: string[]): Promise<TaxonomyDecision[]> {
    if (!terms.length) return [];
    const providerName = await this.settingsService.get<string>(
      'llm_provider',
      'gemini',
    );
    const model = await this.settingsService.get<string>(
      'llm_model',
      'gemini-3.7-flash',
    );
    if (providerName === 'ollama') {
      return this.ollamaProvider.classifySkillTerms(terms);
    }
    if (providerName !== 'gemini') {
      throw new Error(`Unsupported LLM provider: ${providerName}`);
    }
    try {
      return await this.geminiProvider.classifySkillTerms(terms, model);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Gemini taxonomy failed; trying Ollama fallback: ${message}`,
      );
      this.logger.log(
        `Running Ollama taxonomy fallback with ${this.ollamaProvider.getModel()}`,
      );
      try {
        return await this.ollamaProvider.classifySkillTerms(terms);
      } catch (ollamaError: unknown) {
        const ollamaMessage =
          ollamaError instanceof Error
            ? ollamaError.message
            : String(ollamaError);
        this.logger.error(`Ollama taxonomy fallback failed: ${ollamaMessage}`);
        throw ollamaError;
      }
    }
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
