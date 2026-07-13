import { LlmService } from './llm.service';

describe('LlmService master CV integration', () => {
  it('uses the authoritative current CV for job analysis', async () => {
    const settings = {
      get: jest.fn(async (key: string) => key === 'llm_provider' ? 'gemini' : 'gemini-2.5-flash'),
      getMasterCvText: jest.fn(async () => 'Current editable CV'),
    };
    const gemini = {
      analyzeJob: jest.fn(async () => ({ score: 90 })),
    };
    const service = new LlmService(settings as any, gemini as any);

    await service.analyzeJob('Job description');

    expect(settings.getMasterCvText).toHaveBeenCalledTimes(1);
    expect(gemini.analyzeJob).toHaveBeenCalledWith(
      'Job description',
      'Current editable CV',
      'gemini-2.5-flash',
    );
  });
});
