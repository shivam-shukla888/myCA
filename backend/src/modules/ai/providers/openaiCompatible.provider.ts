import { AIProvider, GenerateOptions } from './aiProvider.interface.js';
import {
  AIStructuredResponse,
  aiStructuredResponseSchema,
  INTENT_CATEGORIES,
  RISK_LEVELS,
  IntentCategory,
  RiskLevel,
} from '../schemas/aiResponse.schema.js';
import { AppError } from '../../../middleware/errorHandler.js';

export interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerName: string;
}

export class OpenAICompatibleProvider implements AIProvider {
  private config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
  }

  getModelName(): string {
    return `${this.config.providerName}:${this.config.model}`;
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey && this.config.apiKey.length > 5);
  }

  async generateStructuredResponse(
    prompt: string,
    options?: GenerateOptions
  ): Promise<AIStructuredResponse> {
    if (!this.isAvailable()) {
      throw new AppError(
        `${this.config.providerName} API key is not configured.`,
        503,
        `${this.config.providerName.toUpperCase()}_CONFIGURATION_REQUIRED`
      );
    }

    const messages = [];
    if (options?.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({
      role: 'user',
      content: `${prompt}

OUTPUT FORMAT SPECIFICATION:
You MUST output ONLY a single valid JSON object strictly matching this schema:
{
  "answer": "string containing factual, grounded response",
  "intent": "TAX_QUERY" | "TRANSACTION_ANALYSIS" | "PERSONAL_FINANCE" | "GST_QUERY" | "INVESTMENT_EDUCATION" | "GENERAL_FINANCE" | "DOCUMENT_ANALYSIS" | "UNSUPPORTED_HIGH_RISK" | "OTHER",
  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "confidence_score": 0.95,
  "evidence": [{"source_type": "domain_knowledge", "claim": "statutory provision"}],
  "missing_information": [],
  "disclaimer_required": true,
  "disclaimer": "string",
  "human_review_required": false,
  "refusal_or_limitation": null
}`,
    });

    const MAX_RETRIES = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const url = `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            messages,
            temperature: options?.temperature ?? 0.1,
            max_tokens: options?.maxOutputTokens ?? 2048,
            response_format: { type: 'json_object' },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`HTTP ${res.status}: ${errBody}`);
        }

        const data: any = await res.json();
        const rawContent = data.choices?.[0]?.message?.content;

        if (!rawContent) {
          throw new AppError('Empty response content received from model', 502, 'AI_EMPTY_RESPONSE');
        }

        // Clean any potential markdown fences
        const cleaned = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

        let parsed: any;
        try {
          parsed = JSON.parse(cleaned);
        } catch (e) {
          throw new AppError('Model output could not be parsed as JSON', 502, 'AI_MALFORMED_OUTPUT');
        }

        // Sanitize and normalize fields for schema conformity
        const normalized = this.normalizeOutput(parsed);

        const validated = aiStructuredResponseSchema.safeParse(normalized);
        if (!validated.success) {
          throw new AppError(
            'Model output violated required structured schema',
            502,
            'AI_SCHEMA_VALIDATION_FAILED',
            validated.error.errors
          );
        }

        return validated.data;
      } catch (err: any) {
        lastError = err;
        if (err instanceof AppError && err.code === 'AI_SCHEMA_VALIDATION_FAILED') {
          throw err;
        }

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new AppError(
      `${this.config.providerName} generation failed: ${lastError?.message || 'Unknown error'}`,
      502,
      'AI_PROVIDER_FAILURE'
    );
  }

  private normalizeOutput(parsed: any): any {
    const copy = { ...parsed };

    // 1. Normalize intent
    if (typeof copy.intent === 'string') {
      const upper = copy.intent.toUpperCase().replace(/\s+/g, '_');
      if (INTENT_CATEGORIES.includes(upper as IntentCategory)) {
        copy.intent = upper;
      } else if (upper.includes('TAX')) {
        copy.intent = 'TAX_QUERY';
      } else if (upper.includes('GST')) {
        copy.intent = 'GST_QUERY';
      } else if (upper.includes('INVEST') || upper.includes('STOCK')) {
        copy.intent = 'INVESTMENT_EDUCATION';
      } else if (upper.includes('TRANSACTION') || upper.includes('EXPENSE')) {
        copy.intent = 'TRANSACTION_ANALYSIS';
      } else {
        copy.intent = 'GENERAL_FINANCE';
      }
    } else {
      copy.intent = 'GENERAL_FINANCE';
    }

    // 2. Normalize risk_level
    if (typeof copy.risk_level === 'string') {
      const upperRisk = copy.risk_level.toUpperCase();
      if (RISK_LEVELS.includes(upperRisk as RiskLevel)) {
        copy.risk_level = upperRisk;
      } else {
        copy.risk_level = 'LOW';
      }
    } else {
      copy.risk_level = 'LOW';
    }

    // 3. Normalize evidence to array of objects
    if (!Array.isArray(copy.evidence)) {
      if (typeof copy.evidence === 'string' && copy.evidence.length > 0) {
        copy.evidence = [{ source_type: 'domain_knowledge', claim: copy.evidence }];
      } else {
        copy.evidence = [];
      }
    } else {
      copy.evidence = copy.evidence.map((item: any) => {
        if (typeof item === 'string') {
          return { source_type: 'domain_knowledge', claim: item };
        }
        if (item && typeof item === 'object') {
          return {
            source_type: ['transaction', 'goal', 'document', 'calculation', 'domain_knowledge'].includes(item.source_type)
              ? item.source_type
              : 'domain_knowledge',
            source_id: item.source_id,
            claim: item.claim || String(item),
          };
        }
        return { source_type: 'domain_knowledge', claim: 'General claim' };
      });
    }

    // 4. Normalize missing_information to string array
    if (!Array.isArray(copy.missing_information)) {
      copy.missing_information = [];
    }

    // 5. Confidence score
    if (typeof copy.confidence_score !== 'number' || isNaN(copy.confidence_score)) {
      copy.confidence_score = 0.85;
    } else {
      copy.confidence_score = Math.max(0, Math.min(1, copy.confidence_score));
    }

    // 6. Booleans
    copy.disclaimer_required = Boolean(copy.disclaimer_required);
    copy.human_review_required = Boolean(copy.human_review_required);
    copy.disclaimer = typeof copy.disclaimer === 'string' ? copy.disclaimer : '';
    copy.refusal_or_limitation = typeof copy.refusal_or_limitation === 'string' ? copy.refusal_or_limitation : null;

    return copy;
  }
}
