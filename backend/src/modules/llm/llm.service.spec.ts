import { LlmService } from './llm.service';
import { SettingsService } from '../settings/settings.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { InvalidLlmOutputError } from './analysis-validation';

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

});
