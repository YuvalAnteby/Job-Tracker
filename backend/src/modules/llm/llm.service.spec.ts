import { LlmService } from './llm.service';
import { SettingsService } from '../settings/settings.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { InvalidLlmOutputError } from './analysis-validation';
import { JobSummaryInput } from './interfaces/job-analysis.interface';

const gapSummary = {
  domains: {
    BACKEND: {
      missing_skills: ['Kafka'],
      partially_known: ['Kubernetes'],
      gaps_detail:
        'The target roles expect deeper distributed-systems experience.',
    },
  },
  overall_top_gaps: ['Kafka', 'Kubernetes'],
};

const gapJobs: JobSummaryInput[] = [
  {
    title: 'Backend Engineer',
    company_name: 'Acme',
    domain: 'BACKEND',
    requirements: [
      {
        name: 'Kafka',
        met_status: 'NOT_MET',
        reasoning: 'No Kafka experience appears in the CV.',
      },
    ],
  },
];

describe('LlmService master CV integration', () => {
  it('uses the authoritative current CV for job analysis', async () => {
    const settings = {
      get: jest.fn((key: string) =>
        Promise.resolve(key === 'llm_provider' ? 'gemini' : 'gemini-2.5-flash'),
      ),
      getMasterCvContext: jest.fn().mockResolvedValue({
        id: 'cv-1',
        revision: 1,
        text: 'Current editable CV',
      }),
    };
    const gemini = {
      analyzeJob: jest.fn().mockResolvedValue({ score: 90 }),
    };
    const ollama = {
      analyzeJob: jest.fn(),
      getModel: jest.fn().mockReturnValue('gpt-oss:20b'),
    };
    const service = new LlmService(
      settings as unknown as SettingsService,
      gemini as unknown as GeminiProvider,
      ollama as unknown as OllamaProvider,
    );

    await service.analyzeJob('Job description');

    expect(settings.getMasterCvContext).toHaveBeenCalledTimes(1);
    expect(gemini.analyzeJob).toHaveBeenCalledWith(
      'Job description',
      'Current editable CV',
      'gemini-2.5-flash',
    );
    expect(ollama.analyzeJob).not.toHaveBeenCalled();
  });

  it.each([
    new Error('Gemini unavailable'),
    new InvalidLlmOutputError('Gemini returned invalid JSON'),
  ])('falls back to Ollama when Gemini fails: %s', async (geminiError) => {
    const settings = {
      get: jest.fn((key: string) =>
        Promise.resolve(key === 'llm_provider' ? 'gemini' : 'gemini-test'),
      ),
      getMasterCvContext: jest.fn().mockResolvedValue({
        id: 'cv-1',
        revision: 1,
        text: 'Current editable CV',
      }),
    };
    const gemini = {
      analyzeJob: jest.fn().mockRejectedValue(geminiError),
    };
    const ollama = {
      analyzeJob: jest.fn().mockResolvedValue({ score: 82 }),
      getModel: jest.fn().mockReturnValue('gpt-oss:20b'),
    };
    const service = new LlmService(
      settings as unknown as SettingsService,
      gemini as unknown as GeminiProvider,
      ollama as unknown as OllamaProvider,
    );

    const result = await service.analyzeJob('Job description');

    expect(ollama.analyzeJob).toHaveBeenCalledWith(
      'Job description',
      'Current editable CV',
    );
    expect(result).toMatchObject({
      model: 'ollama:gpt-oss:20b',
      prompt_version: 'job-analysis-v2-ollama',
    });
  });

  it('propagates an Ollama failure after Gemini fails', async () => {
    const settings = {
      get: jest.fn((key: string) =>
        Promise.resolve(key === 'llm_provider' ? 'gemini' : 'gemini-test'),
      ),
      getMasterCvContext: jest.fn().mockResolvedValue({
        id: 'cv-1',
        revision: 1,
        text: 'Current editable CV',
      }),
    };
    const gemini = {
      analyzeJob: jest.fn().mockRejectedValue(new Error('Gemini unavailable')),
    };
    const ollama = {
      analyzeJob: jest.fn().mockRejectedValue(new Error('Ollama unavailable')),
      getModel: jest.fn().mockReturnValue('gpt-oss:20b'),
    };
    const service = new LlmService(
      settings as unknown as SettingsService,
      gemini as unknown as GeminiProvider,
      ollama as unknown as OllamaProvider,
    );

    await expect(service.analyzeJob('Job description')).rejects.toThrow(
      'Ollama unavailable',
    );
  });

  it('uses Gemini for gap summaries before trying Ollama', async () => {
    const settings = {
      get: jest.fn((key: string) =>
        Promise.resolve(key === 'llm_provider' ? 'gemini' : 'gemini-test'),
      ),
      getMasterCvContext: jest.fn().mockResolvedValue({
        id: 'cv-1',
        revision: 1,
        text: 'Current editable CV',
      }),
    };
    const gemini = {
      generateGapSummary: jest.fn().mockResolvedValue(gapSummary),
    };
    const ollama = {
      generateGapSummary: jest.fn(),
      getModel: jest.fn().mockReturnValue('gemma4:12b'),
    };
    const service = new LlmService(
      settings as unknown as SettingsService,
      gemini as unknown as GeminiProvider,
      ollama as unknown as OllamaProvider,
    );

    const result = await service.generateGapSummary(gapJobs);

    expect(gemini.generateGapSummary).toHaveBeenCalledWith(
      gapJobs,
      'Current editable CV',
      'gemini-test',
    );
    expect(ollama.generateGapSummary).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: gapSummary,
      model: 'gemini-test',
      prompt_version: 'gap-summary-v2',
    });
  });

  it.each([
    new Error('Gemini unavailable'),
    new InvalidLlmOutputError('Gemini returned invalid JSON'),
  ])(
    'falls back to Ollama for gap summaries when Gemini fails: %s',
    async (geminiError) => {
      const settings = {
        get: jest.fn((key: string) =>
          Promise.resolve(key === 'llm_provider' ? 'gemini' : 'gemini-test'),
        ),
        getMasterCvContext: jest.fn().mockResolvedValue({
          id: 'cv-1',
          revision: 1,
          text: 'Current editable CV',
        }),
      };
      const gemini = {
        generateGapSummary: jest.fn().mockRejectedValue(geminiError),
      };
      const ollama = {
        generateGapSummary: jest.fn().mockResolvedValue(gapSummary),
        getModel: jest.fn().mockReturnValue('gemma4:12b'),
      };
      const service = new LlmService(
        settings as unknown as SettingsService,
        gemini as unknown as GeminiProvider,
        ollama as unknown as OllamaProvider,
      );

      const result = await service.generateGapSummary(gapJobs);

      expect(ollama.generateGapSummary).toHaveBeenCalledWith(
        gapJobs,
        'Current editable CV',
      );
      expect(result).toMatchObject({
        data: gapSummary,
        model: 'ollama:gemma4:12b',
        prompt_version: 'gap-summary-v2-ollama',
      });
    },
  );

  it('propagates an Ollama gap-summary failure after Gemini fails', async () => {
    const settings = {
      get: jest.fn((key: string) =>
        Promise.resolve(key === 'llm_provider' ? 'gemini' : 'gemini-test'),
      ),
      getMasterCvContext: jest.fn().mockResolvedValue({
        id: 'cv-1',
        revision: 1,
        text: 'Current editable CV',
      }),
    };
    const gemini = {
      generateGapSummary: jest
        .fn()
        .mockRejectedValue(new Error('Gemini unavailable')),
    };
    const ollama = {
      generateGapSummary: jest
        .fn()
        .mockRejectedValue(new Error('Ollama unavailable')),
      getModel: jest.fn().mockReturnValue('gemma4:12b'),
    };
    const service = new LlmService(
      settings as unknown as SettingsService,
      gemini as unknown as GeminiProvider,
      ollama as unknown as OllamaProvider,
    );

    await expect(service.generateGapSummary(gapJobs)).rejects.toThrow(
      'Ollama unavailable',
    );
  });
});
