import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';

describe('GeminiProvider validation repair', () => {
  it('makes one repair attempt and then fails invalid output', async () => {
    const provider = new GeminiProvider({
      get: (): string => 'test-key',
    } as unknown as ConfigService);
    const generateContent = jest.fn().mockResolvedValue({ text: '{' });
    Reflect.set(provider, 'ai', { models: { generateContent } });

    await expect(provider.analyzeJob('description', 'cv')).rejects.toThrow(
      'Response was not valid JSON',
    );
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
