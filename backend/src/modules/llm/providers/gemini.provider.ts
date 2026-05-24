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
    model: string = 'gemini-2.5-flash',
  ): Promise<JobAnalysis> {
    if (!this.ai) {
      throw new Error('Gemini AI not initialized (missing API key)');
    }

    const prompt = `
      You are an expert technical recruiter. Analyze the following job description against the provided CV.
      
      CV Content:
      ${cvText}
      
      Job Description:
      ${jobDescription}
      
      Tasks:
      1. Extract the company name and job title from the description.
      2. Assign a fit score (0-100) based on how well the candidate's experience matches the job requirements.
      3. Classify the job into one of these domains: ${Object.values(Domain).join(', ')}.
      4. Provide a concise 2-3 sentence summary of the job and why it's a good/bad fit.
      5. List the key requirements of the job and whether they are met by the candidate, with brief reasoning.
      
      Respond only with a valid JSON object matching the requested schema.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              company_name: { type: Type.STRING },
              title: { type: Type.STRING },
              score: { type: Type.NUMBER },
              domain: {
                type: Type.STRING,
                enum: Object.values(Domain),
              },
              summary: { type: Type.STRING },
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
                  },
                  required: ['name', 'met_status', 'reasoning'],
                },
              },
            },
            required: ['company_name', 'title', 'score', 'domain', 'requirements', 'summary'],
          },
        },
      });

      return JSON.parse(response.text || '{}') as JobAnalysis;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error generating content with Gemini: ${message}`);
      throw error;
    }
  }

  async generateGapSummary(
    jobs: JobSummaryInput[],
    cvText: string,
    model: string = 'gemini-2.5-flash',
  ): Promise<GapSummaryResult> {
    if (!this.ai) {
      throw new Error('Gemini AI not initialized (missing API key)');
    }
    
    this.logger.debug(`CV length: ${cvText.length} characters`);
    const jobsJson = JSON.stringify(jobs, null, 2);

    const prompt = `
      You are a career coach and technical expert. You will receive a list of jobs the candidate is interested in and the candidate's CV.
      Your task is to identify skill gaps and provide a structured summary to help the candidate improve their fit for these roles.
      
      CV Content:
      ${cvText}
      
      Jobs and Requirements:
      ${jobsJson}
      
      Tasks:
      1. Group the analysis by domain (e.g., BACKEND, ML, DEVOPS).
      2. For each domain:
         - Identify "missing_skills": skills required by multiple jobs but absent from the CV.
         - Identify "partially_known": skills mentioned in the CV but where the jobs require more depth or specific sub-skills.
         - Provide "gaps_detail": a brief narrative explaining the main hurdles in this domain.
      3. Identify "overall_top_gaps": the top 3-5 most critical skills/technologies the candidate should learn next, across all domains.
      
      Respond only with a valid JSON object matching the requested schema.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: prompt,
        config: {
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

      return JSON.parse(response.text || '{}') as GapSummaryResult;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error generating gap summary with Gemini: ${message}`);
      throw error;
    }
  }

  async extractTextFromImage(base64Image: string): Promise<string> {
    if (!this.ai) {
      throw new Error('Gemini AI not initialized (missing API key)');
    }

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash', // Vision works well with flash
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
      this.logger.error(`Error extracting text from image with Gemini: ${message}`);
      throw error;
    }
  }
}
