import { GoogleGenAI } from '@google/genai';
import { AIProvider, GenerateOptions } from './aiProvider.interface.js';
import {
  AIStructuredResponse,
  aiStructuredResponseSchema,
  geminiResponseSchema,
} from '../schemas/aiResponse.schema.js';
import { env } from '../../../config/env.js';
import { AppError } from '../../../middleware/errorHandler.js';

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI | null = null;
  private readonly modelName = 'gemini-2.5-flash';

  constructor() {
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 5) {
      this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
  }

  getModelName(): string {
    return this.modelName;
  }

  isAvailable(): boolean {
    return Boolean(this.client);
  }

  async generateStructuredResponse(
    prompt: string,
    options?: GenerateOptions
  ): Promise<AIStructuredResponse> {
    if (!this.client) {
      throw new AppError(
        'Gemini AI provider is not configured. GEMINI_API_KEY is required in server environment.',
        503,
        'GEMINI_CONFIGURATION_REQUIRED'
      );
    }

    // Bounded retry policy (max 2 retries on transient network/rate limit issues)
    const MAX_RETRIES = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            temperature: options?.temperature ?? 0.1, // Low temperature for factual precision
            maxOutputTokens: options?.maxOutputTokens ?? 2048,
            systemInstruction: options?.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: geminiResponseSchema as any,
          },
        });

        const rawText = response.text;
        if (!rawText) {
          throw new AppError('Empty response received from Gemini API', 502, 'GEMINI_EMPTY_RESPONSE');
        }

        // Parse JSON
        let parsed: any;
        try {
          parsed = JSON.parse(rawText);
        } catch (e) {
          throw new AppError('Gemini output could not be parsed as JSON', 502, 'GEMINI_MALFORMED_OUTPUT');
        }

        // Strict Zod validation
        const validated = aiStructuredResponseSchema.safeParse(parsed);
        if (!validated.success) {
          throw new AppError(
            'Gemini output violated required structured schema',
            502,
            'GEMINI_SCHEMA_VALIDATION_FAILED',
            validated.error.errors
          );
        }

        return validated.data;
      } catch (err: any) {
        lastError = err;
        if (err instanceof AppError && err.code === 'GEMINI_SCHEMA_VALIDATION_FAILED') {
          // Do not retry schema failures
          throw err;
        }

        // If rate limited or transient error, delay briefly before retry
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new AppError(
      `Gemini generation failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message || 'Unknown error'}`,
      502,
      'GEMINI_API_FAILURE'
    );
  }
}
