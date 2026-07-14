import { LlmService } from './llm.service';
import { SettingsService } from '../settings/settings.service';
import { GeminiProvider } from './providers/gemini.provider';

describe('LlmService master CV integration', () => {
  it('uses the authoritative current CV for job analysis', async () => {
    const settings = {
      get: jest.fn((key: string) =>
        Promise.resolve(key === 'llm_provider' ? 'gemini' : 'gemini-2.5-flash'),
      ),
      getMasterCvText: jest.fn().mockResolvedValue('Current editable CV'),
    };
    const gemini = {
      analyzeJob: jest.fn().mockResolvedValue({ score: 90 }),
    };
    const service = new LlmService(
      settings as unknown as SettingsService,
      gemini as unknown as GeminiProvider,
    );

    await service.analyzeJob('Job description');

    expect(settings.getMasterCvText).toHaveBeenCalledTimes(1);
    expect(gemini.analyzeJob).toHaveBeenCalledWith(
      'Job description',
      'Current editable CV',
      'gemini-2.5-flash',
    );
  });
});
