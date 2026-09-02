import { AIStructuredResponse } from '../schemas/aiResponse.schema.js';

export interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
}

export interface AIProvider {
  /**
   * Generates a structured response adhering strictly to AIStructuredResponse schema
   */
  generateStructuredResponse(
    prompt: string,
    options?: GenerateOptions
  ): Promise<AIStructuredResponse>;

  /**
   * Returns human-readable model identifier
   */
  getModelName(): string;

  /**
   * Checks whether the provider is properly configured with credentials
   */
  isAvailable(): boolean;
}
