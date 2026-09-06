import { redactSensitiveData } from '../../../middleware/logger.js';
import { env } from '../../../config/env.js';

export type AIErrorCategory =
  | 'RETRIEVAL_FAILED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CALCULATION_FAILED'
  | 'CURRENT_FACT_UNVERIFIED'
  | 'AI_PROVIDER_FAILED'
  | 'VALIDATION_FAILED'
  | 'SAFETY_BLOCK'
  | 'AUTHORIZATION_FAILED';

export interface PipelineObservabilityEvent {
  request_id: string;
  user_id?: string;
  intent: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  retrieved_source_ids: string[];
  retrieval_confidence: number;
  calculation_ids: string[];
  verification_status: 'VERIFIED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_APPLICABLE' | 'FAILED';
  validator_status: 'PASS' | 'REGENERATE' | 'SAFE_FAILURE';
  confidence_level: 'high' | 'medium' | 'low' | 'very_low';
  provider: string;
  model: string;
  latency_ms: number;
  retry_count: number;
  failure_reason?: string;
  error_category?: AIErrorCategory;
  timestamp: string;
}

export const inMemoryObservabilityEvents: PipelineObservabilityEvent[] = [];

export class AIObservabilityTracker {
  /**
   * Records a structured telemetry event for an AI pipeline execution cycle.
   * Strips all credentials, secrets, tokens, and raw private conversation content.
   */
  logPipelineEvent(event: PipelineObservabilityEvent): PipelineObservabilityEvent {
    // Zero-trust redaction pass
    const sanitized = redactSensitiveData({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    }) as PipelineObservabilityEvent;

    // Retain in-memory log for audit/testing
    inMemoryObservabilityEvents.push(sanitized);

    // Structured JSON log output for production observability log aggregators (e.g. Datadog, CloudWatch, GCP)
    const logPayload = {
      level: sanitized.error_category ? 'WARN' : 'INFO',
      type: 'AI_PIPELINE_TELEMETRY',
      request_id: sanitized.request_id,
      user_id: sanitized.user_id,
      intent: sanitized.intent,
      risk_level: sanitized.risk_level,
      retrieved_source_ids: sanitized.retrieved_source_ids,
      retrieval_confidence: sanitized.retrieval_confidence,
      calculation_ids: sanitized.calculation_ids,
      verification_status: sanitized.verification_status,
      validator_status: sanitized.validator_status,
      confidence_level: sanitized.confidence_level,
      provider: sanitized.provider,
      model: sanitized.model,
      latency_ms: sanitized.latency_ms,
      retry_count: sanitized.retry_count,
      error_category: sanitized.error_category,
      failure_reason: sanitized.failure_reason,
      timestamp: sanitized.timestamp,
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify(logPayload));
    }

    return sanitized;
  }

  /**
   * Helper to format human-friendly uncertainty messages for normal users
   * while logging the precise technical error category internally.
   */
  getUserFriendlyErrorMessage(category: AIErrorCategory): string {
    switch (category) {
      case 'INSUFFICIENT_EVIDENCE':
      case 'RETRIEVAL_FAILED':
        return "I don't have enough verified information to answer this accurately.";
      case 'CURRENT_FACT_UNVERIFIED':
        return "I couldn't verify this rule from an authoritative regulatory source right now.";
      case 'CALCULATION_FAILED':
        return "I couldn't verify the financial numbers required for this calculation.";
      case 'AI_PROVIDER_FAILED':
        return "Our intelligence desk is momentarily unavailable. Your financial data remains safe.";
      case 'SAFETY_BLOCK':
        return "I can explain educational frameworks and concepts, but I cannot recommend specific stock trades or guarantee returns.";
      case 'AUTHORIZATION_FAILED':
        return "Please sign in to access your financial records.";
      case 'VALIDATION_FAILED':
      default:
        return "I couldn't verify that information right now.";
    }
  }

  getRecentEvents(limit = 50): PipelineObservabilityEvent[] {
    return inMemoryObservabilityEvents.slice(-limit);
  }

  clearEvents(): void {
    inMemoryObservabilityEvents.length = 0;
  }
}

export const aiObservability = new AIObservabilityTracker();
