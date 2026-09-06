import { AIProvider, GenerateOptions } from './aiProvider.interface.js';
import { AIStructuredResponse } from '../schemas/aiResponse.schema.js';
import { AppError } from '../../../middleware/errorHandler.js';

export interface FailoverEvent {
  primaryModel: string;
  fallbackModel: string;
  primaryError: string;
  primaryLatencyMs: number;
  fallbackLatencyMs?: number;
  failoverTimestamp: string;
  selectedProvider: string;
  status: 'FAILOVER_SUCCESS' | 'ALL_PROVIDERS_FAILED';
}

export class FallbackAIProvider implements AIProvider {
  private primary: AIProvider;
  private fallback: AIProvider;
  private lastUsedProviderName: string;
  private lastFailoverEvent: FailoverEvent | null = null;

  constructor(primary: AIProvider, fallback: AIProvider) {
    this.primary = primary;
    this.fallback = fallback;
    this.lastUsedProviderName = primary.getModelName();
  }

  getModelName(): string {
    return this.lastUsedProviderName;
  }

  getLastFailoverEvent(): FailoverEvent | null {
    return this.lastFailoverEvent;
  }

  isAvailable(): boolean {
    return this.primary.isAvailable() || this.fallback.isAvailable();
  }

  async generateStructuredResponse(
    prompt: string,
    options?: GenerateOptions
  ): Promise<AIStructuredResponse> {
    let primaryErr: any = null;
    let primaryLatencyMs = 0;

    // 1. Try Primary Provider (Groq) if configured
    if (this.primary.isAvailable()) {
      const startPrimary = Date.now();
      try {
        const response = await this.primary.generateStructuredResponse(prompt, options);
        this.lastUsedProviderName = this.primary.getModelName();
        this.lastFailoverEvent = null; // Clean run
        return response;
      } catch (err: any) {
        primaryLatencyMs = Date.now() - startPrimary;
        primaryErr = err;
        const sanitizedErrMsg = this.sanitizeSecrets(err.message || 'Primary provider error');
        console.warn(
          `[AI Failover] Primary provider (${this.primary.getModelName()}) failed in ${primaryLatencyMs}ms: ${sanitizedErrMsg}. Initiating fallback to ${this.fallback.getModelName()}...`
        );
      }
    }

    // 2. Failover to Fallback Provider (Gemini)
    if (this.fallback.isAvailable()) {
      const startFallback = Date.now();
      try {
        const response = await this.fallback.generateStructuredResponse(prompt, options);
        const fallbackLatencyMs = Date.now() - startFallback;
        this.lastUsedProviderName = this.fallback.getModelName();

        this.lastFailoverEvent = {
          primaryModel: this.primary.getModelName(),
          fallbackModel: this.fallback.getModelName(),
          primaryError: this.sanitizeSecrets(primaryErr?.message || 'Primary unavailable'),
          primaryLatencyMs,
          fallbackLatencyMs,
          failoverTimestamp: new Date().toISOString(),
          selectedProvider: this.fallback.getModelName(),
          status: 'FAILOVER_SUCCESS',
        };

        return response;
      } catch (err: any) {
        const fallbackLatencyMs = Date.now() - startFallback;
        const sanitizedFallbackErr = this.sanitizeSecrets(err.message || 'Fallback provider error');

        this.lastFailoverEvent = {
          primaryModel: this.primary.getModelName(),
          fallbackModel: this.fallback.getModelName(),
          primaryError: this.sanitizeSecrets(primaryErr?.message || 'Primary unavailable'),
          primaryLatencyMs,
          fallbackLatencyMs,
          failoverTimestamp: new Date().toISOString(),
          selectedProvider: 'NONE',
          status: 'ALL_PROVIDERS_FAILED',
        };

        throw new AppError(
          `Both primary and fallback AI providers failed: ${sanitizedFallbackErr}`,
          503,
          'ALL_AI_PROVIDERS_UNAVAILABLE'
        );
      }
    }

    // 3. Safe Unavailable State (Fail Closed)
    throw new AppError(
      'No AI provider is currently configured with valid credentials. System is in safe unavailable state.',
      503,
      'AI_PROVIDER_CONFIGURATION_REQUIRED'
    );
  }

  private sanitizeSecrets(text: string): string {
    if (!text) return '';
    return text
      .replace(/gsk_[a-zA-Z0-9]{20,}/g, '[REDACTED_GROQ_KEY]')
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]')
      .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_KEY]')
      .replace(/Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, 'Bearer [REDACTED_TOKEN]');
  }
}
