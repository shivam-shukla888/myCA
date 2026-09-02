import { AIProvider, GenerateOptions } from './aiProvider.interface.js';
import { AIStructuredResponse } from '../schemas/aiResponse.schema.js';
import { AppError } from '../../../middleware/errorHandler.js';

export class FallbackAIProvider implements AIProvider {
  private primary: AIProvider;
  private fallback: AIProvider;
  private lastUsedProviderName: string;

  constructor(primary: AIProvider, fallback: AIProvider) {
    this.primary = primary;
    this.fallback = fallback;
    this.lastUsedProviderName = primary.getModelName();
  }

  getModelName(): string {
    return this.lastUsedProviderName;
  }

  isAvailable(): boolean {
    return this.primary.isAvailable() || this.fallback.isAvailable();
  }

  async generateStructuredResponse(
    prompt: string,
    options?: GenerateOptions
  ): Promise<AIStructuredResponse> {
    // 1. Try Primary Provider if configured
    if (this.primary.isAvailable()) {
      try {
        const response = await this.primary.generateStructuredResponse(prompt, options);
        this.lastUsedProviderName = this.primary.getModelName();
        return response;
      } catch (err: any) {
        console.warn(`[AI Failover] Primary provider (${this.primary.getModelName()}) failed: ${err.message}. Failing over to fallback...`);
      }
    }

    // 2. Failover to Fallback Provider
    if (this.fallback.isAvailable()) {
      try {
        const response = await this.fallback.generateStructuredResponse(prompt, options);
        this.lastUsedProviderName = this.fallback.getModelName();
        return response;
      } catch (err: any) {
        throw new AppError(
          `Both primary and fallback AI providers failed: ${err.message}`,
          503,
          'ALL_AI_PROVIDERS_UNAVAILABLE'
        );
      }
    }

    throw new AppError(
      'No AI provider is currently configured with valid credentials.',
      503,
      'AI_PROVIDER_CONFIGURATION_REQUIRED'
    );
  }
}
