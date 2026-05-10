import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { LlmProvider } from '../llm.provider';
import { JobAnalysis } from '../interfaces/job-analysis.interface';
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
      this.logger.error('GEMINI_API_KEY is not defined in environment variables');
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
      1. Assign a fit score (0-100) based on how well the candidate's experience matches the job requirements.
      2. Classify the job into one of these domains: ${Object.values(Domain).join(', ')}.
      3. Provide a concise 2-3 sentence summary of the job and why it's a good/bad fit.
      4. List the key requirements of the job and whether they are met by the candidate, with brief reasoning.
      
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
                    reasoning: { type: Type.STRING }
                  },
                  required: ['name', 'met_status', 'reasoning']
                }
              }
            },
            required: ['score', 'domain', 'requirements']
          }
        }
      });

      return JSON.parse(response.text || '{}') as JobAnalysis;
    } catch (error) {
      this.logger.error(`Error generating content with Gemini: ${error.message}`);
      throw error;
    }
  }
}
