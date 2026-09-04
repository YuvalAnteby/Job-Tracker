import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Domain } from '../../jobs/enums/domain.enum';
import { MetStatus } from '../../jobs/enums/met-status.enum';
import {
  InvalidLlmOutputError,
  parseGapSummary,
  parseJobAnalysis,
} from '../analysis-validation';
import {
  GapSummaryResult,
  JobAnalysis,
  JobSummaryInput,
} from '../interfaces/job-analysis.interface';
import {
  TaxonomyDecision,
  TaxonomyConfidence,
  TaxonomyDecisionType,
  parseTaxonomyDecisions,
} from '../interfaces/skill-taxonomy.interface';
import { truncate } from 'fs';

type OllamaThink = boolean | 'low' | 'medium' | 'high' | 'max';

interface JsonSchema {
  type: string | string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: JsonSchema | boolean;
  items?: JsonSchema;
  required?: string[];
  enum?: readonly string[];
}

type OllamaOperation = 'job-analysis' | 'gap-summary' | 'skill-taxonomy';

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  done_reason?: string;
}

const DEFAULT_BASE_URL = 'http://host.docker.internal:11434';
const DEFAULT_MODEL = 'gemma4:12b';
const DEFAULT_TIMEOUT_MS = 300_000;

const JOB_ANALYSIS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    company_name: { type: 'string' },
    title: { type: 'string' },
    domain: { type: 'string', enum: Object.values(Domain) },
    summary: { type: 'string' },
    score_breakdown: {
      type: 'object',
      properties: {
        hard_requirements: { type: 'integer' },
        preferred_requirements: { type: 'integer' },
        technical_stack: { type: 'integer' },
        seniority_eligibility: { type: 'integer' },
        domain_alignment: { type: 'integer' },
        logistics_availability: { type: 'integer' },
      },
      required: [
        'hard_requirements',
        'preferred_requirements',
        'technical_stack',
        'seniority_eligibility',
        'domain_alignment',
        'logistics_availability',
      ],
    },
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          met_status: { type: 'string', enum: Object.values(MetStatus) },
          reasoning: { type: 'string' },
          job_description_excerpt: { type: ['string', 'null'] },
          cv_evidence: { type: ['string', 'null'] },
          evidence_inferred: { type: 'boolean' },
        },
        required: [
          'name',
          'met_status',
          'reasoning',
          'job_description_excerpt',
          'cv_evidence',
          'evidence_inferred',
        ],
      },
    },
  },
  required: [
    'company_name',
    'title',
    'domain',
    'summary',
    'score_breakdown',
    'requirements',
  ],
};

const JOB_ANALYSIS_SYSTEM_PROMPT = `
You are a senior technical hiring manager and ATS keyword matching expert.
Analyze the job description against the candidate CV.

Reason carefully internally, but return only the final JSON object. Never include
your reasoning trace, markdown, or a preamble. Extract company_name and title,
score each fit dimension from 0 through 100, classify the role into the allowed
domain values, summarize the fit in 2-3 sentences, and list every key requirement.
For unmet or uncertain requirements, quote a short job-description excerpt. For
met requirements, quote CV evidence or set evidence_inferred to true only when
the evidence is indirect. Never invent evidence.

The response must match this JSON schema:
${JSON.stringify(JOB_ANALYSIS_SCHEMA)}
`;

const GAP_SUMMARY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    domains: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          missing_skills: {
            type: 'array',
            items: { type: 'string' },
          },
          partially_known: {
            type: 'array',
            items: { type: 'string' },
          },
          gaps_detail: { type: 'string' },
        },
        required: ['missing_skills', 'partially_known', 'gaps_detail'],
      },
    },
    overall_top_gaps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['domains', 'overall_top_gaps'],
};

const GAP_SUMMARY_SYSTEM_PROMPT = `
You are an expert technical career coach and ATS keyword matching expert.
Analyze the candidate CV against the provided job requirements.

Reason carefully internally, but return only the final JSON object. Never include
your reasoning trace, markdown, or a preamble. Group the analysis by allowed
domain values: ${Object.values(Domain).join(', ')}. For each domain, identify
missing skills, partially known skills, and the main gaps. Then return the top
3-5 skills or technologies the candidate should learn next across all domains.
Only include domains represented by the provided jobs, and do not invent skills
that are not supported by the job requirements.

The response must match this JSON schema:
${JSON.stringify(GAP_SUMMARY_SCHEMA)}
`;

const TAXONOMY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string' },
          decision: {
            type: 'string',
            enum: Object.values(TaxonomyDecisionType),
          },
          canonical_name: { type: ['string', 'null'] },
          confidence: {
            type: 'string',
            enum: Object.values(TaxonomyConfidence),
          },
        },
        required: ['term', 'decision', 'canonical_name', 'confidence'],
      },
    },
  },
  required: ['decisions'],
};

const TAXONOMY_SYSTEM_PROMPT = `
Classify each job requirement term for a technical learning tracker. TRACK only
concrete technical tools, programming languages, platforms, frameworks, and
technical practices. EXCLUDE credentials, spoken languages, seniority,
experience duration, soft traits, and other non-technical constraints. Use
UNSURE for ambiguity. TRACK needs one concise canonical name and HIGH
confidence only when clear. Return only JSON matching the schema.
`;

@Injectable()
export class OllamaProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly think: OllamaThink;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const configuredBaseUrl = this.configService.get<string>(
      'OLLAMA_BASE_URL',
      DEFAULT_BASE_URL,
    );
    const configuredModel = this.configService.get<string>(
      'OLLAMA_MODEL',
      DEFAULT_MODEL,
    );
    const configuredThink = this.configService.get<string>(
      'OLLAMA_THINK',
      'medium',
    );
    const configuredTimeout = this.configService.get<string>(
      'OLLAMA_TIMEOUT_MS',
      String(DEFAULT_TIMEOUT_MS),
    );

    this.baseUrl =
      configuredBaseUrl.trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
    this.model = configuredModel.trim() || DEFAULT_MODEL;
    this.think = this.parseThink(configuredThink);
    this.timeoutMs = this.parseTimeout(configuredTimeout);
  }

  getModel(): string {
    return this.model;
  }

  async analyzeJob(
    jobDescription: string,
    cvText: string,
  ): Promise<JobAnalysis> {
    const content = await this.chat(
      'job-analysis',
      JOB_ANALYSIS_SYSTEM_PROMPT,
      `CV Content:\n${cvText}\n\nJob Description:\n${jobDescription}`,
      JOB_ANALYSIS_SCHEMA,
    );
    return parseJobAnalysis(content);
  }

  async generateGapSummary(
    jobs: JobSummaryInput[],
    cvText: string,
  ): Promise<GapSummaryResult> {
    const content = await this.chat(
      'gap-summary',
      GAP_SUMMARY_SYSTEM_PROMPT,
      `CV Content:\n${cvText}\n\nJobs and Requirements:\n${JSON.stringify(jobs, null, 2)}`,
      GAP_SUMMARY_SCHEMA,
    );
    return parseGapSummary(content);
  }

  async classifySkillTerms(terms: string[]): Promise<TaxonomyDecision[]> {
    const content = await this.chat(
      'skill-taxonomy',
      TAXONOMY_SYSTEM_PROMPT,
      JSON.stringify({ terms }),
      TAXONOMY_SCHEMA,
    );
    return parseTaxonomyDecisions(content, terms);
  }

  private async chat(
    operation: OllamaOperation,
    systemPrompt: string,
    userContent: string,
    format: JsonSchema,
  ): Promise<string> {
    const inputChars = systemPrompt.length + userContent.length;
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        stream: false,
        think: this.think,
        truncate: false,
        shift: false,
        format,
        options: { temperature: 0, use_mmap: false, num_ctx: 12288 },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const detail = (await response.text()).trim().slice(0, 300);
      if (
        /context (?:length|size)|too many tokens|input length exceeds/i.test(
          detail,
        )
      ) {
        this.logger.warn(
          `Ollama ${operation} context overflow: input_chars=${inputChars}; response details omitted`,
        );
      }
      throw new Error(
        `Ollama request failed (${response.status})${detail ? `: ${detail}` : ''}`,
      );
    }

    let payload: OllamaChatResponse;
    try {
      payload = (await response.json()) as OllamaChatResponse;
    } catch {
      throw new InvalidLlmOutputError('Ollama returned invalid JSON');
    }

    this.logger.log(
      `Ollama ${operation} completed: prompt_tokens=${payload.prompt_eval_count ?? 'unknown'} ` +
        `output_tokens=${payload.eval_count ?? 'unknown'} ` +
        `done_reason=${payload.done_reason ?? 'unknown'} input_chars=${inputChars}`,
    );

    return this.responseContent(payload);
  }

  private responseContent(payload: unknown): string {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new InvalidLlmOutputError('Ollama response was not an object');
    }

    const message = (payload as Record<string, unknown>).message;
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new InvalidLlmOutputError('Ollama response had no message');
    }

    const content = (message as Record<string, unknown>).content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new InvalidLlmOutputError('Ollama response had no final content');
    }

    return content;
  }

  private parseThink(value: string): OllamaThink {
    switch (value.trim().toLowerCase()) {
      case 'false':
        return false;
      case 'true':
        return true;
      case 'low':
      case 'medium':
      case 'high':
      case 'max':
        return value.trim().toLowerCase() as Exclude<OllamaThink, boolean>;
      default:
        this.logger.warn(`Invalid OLLAMA_THINK value "${value}"; using medium`);
        return 'medium';
    }
  }

  private parseTimeout(value: string): number {
    const timeout = Number(value);
    if (Number.isInteger(timeout) && timeout > 0) return timeout;
    this.logger.warn(
      `Invalid OLLAMA_TIMEOUT_MS value "${value}"; using ${DEFAULT_TIMEOUT_MS}`,
    );
    return DEFAULT_TIMEOUT_MS;
  }
}
