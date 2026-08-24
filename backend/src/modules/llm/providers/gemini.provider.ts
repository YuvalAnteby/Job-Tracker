import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { LlmProvider } from '../llm.provider';
import {
  JobAnalysis,
  GapSummaryResult,
  JobSummaryInput,
} from '../interfaces/job-analysis.interface';
import { Domain } from '../../jobs/enums/domain.enum';
import { MetStatus } from '../../jobs/enums/met-status.enum';
import {
  InvalidLlmOutputError,
  parseGapSummary,
  parseJobAnalysis,
} from '../analysis-validation';

export const JOB_PROMPT_VERSION = 'job-analysis-v2';
export const GAP_PROMPT_VERSION = 'gap-summary-v2';

@Injectable()
export class GeminiProvider extends LlmProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private ai: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    super();
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error(
        'GEMINI_API_KEY is not defined in environment variables',
      );
    } else {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async analyzeJob(
    jobDescription: string,
    cvText: string,
    model: string = 'gemini-3.7-flash',
  ): Promise<JobAnalysis> {
    if (!this.ai) {
      throw new Error('Gemini AI not initialized (missing API key)');
    }
    const systemInstruction = `
      You are a senior technical hiring manager and an ATS keyword matching expert.
      Analyze the provided job description against the candidate's CV.

      Tasks:
        1. Extract the company name and job title from the description. (If company name cannot be determined, return 'Unknown')
        2. Score each requested fit dimension as an integer from 0 through 100.
        3. Classify the job into one of these domains: ${Object.values(Domain).join(', ')}.
        4. Provide a concise 2-3 sentence summary of the job and why it's a good/bad fit.
        5. List every key requirement. For unmet or uncertain requirements, quote a short excerpt from the job description. For met requirements, quote brief CV evidence or mark evidence_inferred true when the evidence is indirect. Never invent evidence.

      Respond only with a valid JSON object matching the requested schema.
    `;

    const prompt = `
      CV Content:
      ${cvText}

      Job Description:
      ${jobDescription}
    `;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents:
            attempt === 0
              ? prompt
              : `${prompt}\nYour previous response failed validation. Return a complete, corrected JSON object only.`,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                company_name: { type: Type.STRING },
                title: { type: Type.STRING },
                domain: {
                  type: Type.STRING,
                  enum: Object.values(Domain),
                },
                summary: { type: Type.STRING },
                score_breakdown: {
                  type: Type.OBJECT,
                  properties: {
                    hard_requirements: { type: Type.INTEGER },
                    preferred_requirements: { type: Type.INTEGER },
                    technical_stack: { type: Type.INTEGER },
                    seniority_eligibility: { type: Type.INTEGER },
                    domain_alignment: { type: Type.INTEGER },
                    logistics_availability: { type: Type.INTEGER },
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
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      met_status: {
                        type: Type.STRING,
                        enum: Object.values(MetStatus),
                      },
                      reasoning: { type: Type.STRING },
                      job_description_excerpt: {
                        type: Type.STRING,
                        nullable: true,
                      },
                      cv_evidence: { type: Type.STRING, nullable: true },
                      evidence_inferred: { type: Type.BOOLEAN },
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
                'requirements',
                'summary',
                'score_breakdown',
              ],
            },
          },
        });
        const raw = response.text;
        if (!raw) throw new InvalidLlmOutputError('Empty response from Gemini');
        return parseJobAnalysis(raw);
      } catch (error: unknown) {
        if (error instanceof InvalidLlmOutputError && attempt === 0) {
          this.logger.warn(
            `Invalid Gemini job analysis, requesting repair: ${error.message}`,
          );
          continue;
        }
        this.logger.error(`Gemini job analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        /*
        this.logger.error(
          error instanceof InvalidLlmOutputError
            ? `Gemini job analysis failed validation: ${error.message}`
            : 'Gemini job analysis provider request failed',
        );*/
        throw error;
      }
    }
    throw new InvalidLlmOutputError('Gemini job analysis retry exhausted');
  }

  async generateGapSummary(
    jobs: JobSummaryInput[],
    cvText: string,
    model: string = 'gemini-3.7-flash',
  ): Promise<GapSummaryResult> {
    if (!this.ai) {
      throw new Error('Gemini AI not initialized (missing API key)');
    }

    this.logger.debug(`CV length: ${cvText.length} characters`);
    const jobsJson = JSON.stringify(jobs, null, 2);
    const systemInstruction = `
      You are an expert technical career coach and an ATS keyword matching expert.
      Analyze the candidate's CV against the provided array of job requirements.
      Your task is to identify skill gaps and provide a structured summary to help the candidate improve their fit for these roles.
      
      Tasks:
      1. Group the analysis by domain (e.g., BACKEND, ML, DEVOPS).
      2. For each domain:
         - Identify "missing_skills": skills required by multiple jobs but absent from the CV.
         - Identify "partially_known": skills mentioned in the CV but where the jobs require more depth or specific sub-skills.
         - Provide "gaps_detail": a brief narrative explaining the main hurdles in this domain.
      3. Identify "overall_top_gaps": the top 3-5 most critical skills/technologies the candidate should learn next, across all domains.
      
      Respond only with a valid JSON object matching the requested schema.
      `;

    const prompt = `
      CV Content:
      ${cvText}
      
      Jobs and Requirements:
      ${jobsJson}
    `;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents:
            attempt === 0
              ? prompt
              : `${prompt}\nYour previous response failed validation. Return a complete, corrected JSON object only.`,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                domains: {
                  type: Type.OBJECT,
                  additionalProperties: {
                    type: Type.OBJECT,
                    properties: {
                      missing_skills: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      partially_known: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      gaps_detail: { type: Type.STRING },
                    },
                    required: [
                      'missing_skills',
                      'partially_known',
                      'gaps_detail',
                    ],
                  },
                },
                overall_top_gaps: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['domains', 'overall_top_gaps'],
            },
          },
        });
        const raw = response.text;
        if (!raw) throw new InvalidLlmOutputError('Empty response from Gemini');
        return parseGapSummary(raw);
      } catch (error: unknown) {
        if (error instanceof InvalidLlmOutputError && attempt === 0) {
          this.logger.warn(
            `Invalid Gemini gap summary, requesting repair: `, error
          );
          continue;
        }
        this.logger.error(
          error instanceof InvalidLlmOutputError
            ? `Gemini gap analysis failed validation: ${error.message}`
            : 'Gemini gap analysis provider request failed',
        );
        throw error;
      }
    }
    throw new InvalidLlmOutputError('Gemini gap analysis retry exhausted');
  }

  async extractTextFromImage(
    base64Image: string,
    model: string = 'gemini-3.7-flash',
  ): Promise<string> {
    if (!this.ai) {
      throw new Error('Gemini AI not initialized (missing API key)');
    }

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Extract all the text from this job posting image. Return only the extracted text, maintaining the original structure as much as possible.',
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
      });

      return response.text || '';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error extracting text from image with Gemini: ${message}`,
      );
      throw error;
    }
  }
}
