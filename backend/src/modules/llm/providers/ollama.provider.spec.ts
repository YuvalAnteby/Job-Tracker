import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Domain } from '../../jobs/enums/domain.enum';
import { MetStatus } from '../../jobs/enums/met-status.enum';
import { OllamaProvider } from './ollama.provider';

const analysis = {
  company_name: 'Acme',
  title: 'Backend Engineer',
  domain: Domain.BACKEND,
  summary: 'Strong fit for the backend role.',
  score_breakdown: {
    hard_requirements: 80,
    preferred_requirements: 70,
    technical_stack: 80,
    seniority_eligibility: 90,
    domain_alignment: 80,
    logistics_availability: 90,
  },
  requirements: [
    {
      name: 'TypeScript',
      met_status: MetStatus.MET,
      reasoning: 'The CV shows professional TypeScript experience.',
      job_description_excerpt: null,
      cv_evidence: 'Built TypeScript services.',
      evidence_inferred: false,
    },
  ],
};

const gapSummary = {
  domains: {
    [Domain.BACKEND]: {
      missing_skills: ['Kafka'],
      partially_known: ['Kubernetes'],
      gaps_detail:
        'The target roles expect deeper distributed-systems experience.',
    },
  },
  overall_top_gaps: ['Kafka', 'Kubernetes'],
};

const makeConfig = (): ConfigService =>
  ({
    get: jest.fn((key: string, fallback?: string): string => {
      const values: Record<string, string> = {
        OLLAMA_BASE_URL: 'http://ollama:11434/',
        OLLAMA_MODEL: 'gpt-oss:20b',
        OLLAMA_THINK: 'medium',
        OLLAMA_TIMEOUT_MS: '300000',
      };
      return values[key] ?? fallback ?? '';
    }),
  }) as unknown as ConfigService;

describe('OllamaProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests reasoning and structured JSON, then validates the final content', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: (): Promise<unknown> =>
        Promise.resolve({
          message: { content: JSON.stringify(analysis) },
        }),
    } as Response);
    const provider = new OllamaProvider(makeConfig());

    await expect(provider.analyzeJob('Job description', 'CV')).resolves.toEqual(
      analysis,
    );

    const [url, init] = fetchMock.mock.calls[0];
    if (typeof init?.body !== 'string') throw new Error('Expected JSON body');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(url).toBe('http://ollama:11434/api/chat');
    expect(body).toMatchObject({
      model: 'gpt-oss:20b',
      stream: false,
      think: 'medium',
      options: { temperature: 0 },
    });
    expect(body.format).toMatchObject({ type: 'object' });
  });

  it('requests and validates a structured gap summary', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: (): Promise<unknown> =>
        Promise.resolve({
          message: { content: JSON.stringify(gapSummary) },
        }),
    } as Response);
    const provider = new OllamaProvider(makeConfig());
    const jobs = [
      {
        title: 'Backend Engineer',
        company_name: 'Acme',
        domain: Domain.BACKEND,
        requirements: [
          {
            name: 'Kafka',
            met_status: MetStatus.NOT_MET,
            reasoning: 'No Kafka experience appears in the CV.',
          },
        ],
      },
    ];

    await expect(provider.generateGapSummary(jobs, 'CV')).resolves.toEqual(
      gapSummary,
    );

    const [url, init] = fetchMock.mock.calls[0];
    if (typeof init?.body !== 'string') throw new Error('Expected JSON body');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(url).toBe('http://ollama:11434/api/chat');
    expect(body).toMatchObject({
      model: 'gpt-oss:20b',
      stream: false,
      think: 'medium',
      options: { temperature: 0 },
    });
    const messagesJson = JSON.stringify(body.messages);
    expect(messagesJson).toContain('system');
    expect(messagesJson).toContain('user');
    expect(messagesJson).toContain('CV');
    expect(messagesJson).toContain('Kafka');
    expect(body.format).toMatchObject({
      type: 'object',
      properties: { domains: { type: 'object' } },
    });
  });

  it('rejects an invalid Ollama response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: (): Promise<unknown> =>
        Promise.resolve({ message: { content: '{' } }),
    } as Response);
    const provider = new OllamaProvider(makeConfig());

    await expect(provider.analyzeJob('Job description', 'CV')).rejects.toThrow(
      'Response was not valid JSON',
    );
  });

  it('rejects an invalid gap summary response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: (): Promise<unknown> =>
        Promise.resolve({
          message: {
            content: JSON.stringify({
              domains: {},
              overall_top_gaps: ['Kafka'],
            }),
          },
        }),
    } as Response);
    const provider = new OllamaProvider(makeConfig());

    await expect(provider.generateGapSummary([], 'CV')).rejects.toThrow(
      'domains cannot be empty',
    );
  });

  it('reports Ollama HTTP failures', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: (): Promise<string> => Promise.resolve('model is unavailable'),
    } as Response);
    const provider = new OllamaProvider(makeConfig());

    await expect(provider.analyzeJob('Job description', 'CV')).rejects.toThrow(
      'Ollama request failed (503): model is unavailable',
    );
  });

  it('logs response metrics without logging CV or job content', async () => {
    const logMock = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: (): Promise<unknown> =>
        Promise.resolve({
          message: { content: JSON.stringify(analysis) },
          prompt_eval_count: 123,
          eval_count: 45,
          done_reason: 'stop',
        }),
    } as Response);
    const provider = new OllamaProvider(makeConfig());

    await provider.analyzeJob('SECRET_JOB_TEXT', 'SECRET_CV_TEXT');

    const metricLog = logMock.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes('Ollama job-analysis completed'));
    expect(metricLog).toBeDefined();
    expect(metricLog).toContain('prompt_tokens=123');
    expect(metricLog).toContain('output_tokens=45');
    expect(metricLog).toContain('done_reason=stop');
    expect(metricLog).not.toContain('SECRET_JOB_TEXT');
    expect(metricLog).not.toContain('SECRET_CV_TEXT');
  });

  it('warns about context overflow without logging request content', async () => {
    const warnMock = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: (): Promise<string> =>
        Promise.resolve('the input length exceeds the context length'),
    } as Response);
    const provider = new OllamaProvider(makeConfig());

    await expect(
      provider.analyzeJob('SECRET_JOB_TEXT', 'SECRET_CV_TEXT'),
    ).rejects.toThrow('Ollama request failed (400)');

    const contextWarning = warnMock.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes('context overflow'));
    expect(contextWarning).toBeDefined();
    expect(contextWarning).toContain('input_chars=');
    expect(contextWarning).not.toContain('SECRET_JOB_TEXT');
    expect(contextWarning).not.toContain('SECRET_CV_TEXT');
  });
});
