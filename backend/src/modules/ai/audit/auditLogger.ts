import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdminClient } from '../../../config/supabase.js';
import { AIStructuredResponse } from '../schemas/aiResponse.schema.js';
import { env } from '../../../config/env.js';

export interface AuditLogEntry {
  id: string;
  user_id: string;
  conversation_id?: string;
  query: string;
  response: string;
  model_used: string;
  confidence_score: number;
  confidence_level: 'high' | 'medium' | 'low' | 'very_low';
  topic_category: 'tax' | 'gst' | 'investment' | 'savings' | 'compliance' | 'general';
  contains_financial_advice: boolean;
  contains_tax_advice: boolean;
  disclaimer_shown: boolean;
  disclaimer_text: string;
  reviewed_by_human: boolean; // Must strictly be false on generation
  created_at: string;
  hmac_signature?: string; // Tamper-evident cryptographic signature
}

export const inMemoryAuditLogs: AuditLogEntry[] = [];

/**
 * Generate canonical string representation for HMAC signing
 */
export function buildAuditCanonicalString(entry: {
  id: string;
  user_id: string;
  query: string;
  response: string;
  model_used: string;
  confidence_score: number;
  disclaimer_shown: boolean;
  created_at: string;
}): string {
  return `${entry.id}|${entry.user_id}|${entry.query}|${entry.response}|${entry.model_used}|${entry.confidence_score}|${entry.disclaimer_shown}|${entry.created_at}`;
}

/**
 * Generate HMAC-SHA256 signature using server secret key
 */
export function generateAuditSignature(canonicalString: string): string {
  const secret = env.ENCRYPTION_SECRET_KEY || 'server-audit-secret-key-default-salt';
  return crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
}

/**
 * Verify whether an audit log entry has been tampered with
 */
export function verifyAuditEntry(entry: AuditLogEntry): boolean {
  if (!entry.hmac_signature) return false;
  const canonical = buildAuditCanonicalString(entry);
  const expectedSignature = generateAuditSignature(canonical);
  // Constant-time comparison to prevent timing attacks
  const actualBuffer = Buffer.from(entry.hmac_signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export class AuditLogger {
  async logRecommendation(
    userId: string,
    query: string,
    aiResponse: AIStructuredResponse,
    modelName: string,
    conversationId?: string
  ): Promise<AuditLogEntry> {
    const id = uuidv4();
    const now = new Date().toISOString();

    // Map confidence score to level
    let confidence_level: 'high' | 'medium' | 'low' | 'very_low' = 'medium';
    if (aiResponse.confidence_score >= 0.85) confidence_level = 'high';
    else if (aiResponse.confidence_score >= 0.65) confidence_level = 'medium';
    else if (aiResponse.confidence_score >= 0.40) confidence_level = 'low';
    else confidence_level = 'very_low';

    // Map intent to topic category
    let topic_category: 'tax' | 'gst' | 'investment' | 'savings' | 'compliance' | 'general' = 'general';
    if (aiResponse.intent === 'TAX_QUERY') topic_category = 'tax';
    else if (aiResponse.intent === 'GST_QUERY') topic_category = 'gst';
    else if (aiResponse.intent === 'INVESTMENT_EDUCATION' || aiResponse.intent === 'UNSUPPORTED_HIGH_RISK') topic_category = 'investment';
    else if (aiResponse.intent === 'PERSONAL_FINANCE') topic_category = 'savings';

    const entry: AuditLogEntry = {
      id,
      user_id: userId,
      conversation_id: conversationId,
      query,
      response: aiResponse.answer,
      model_used: modelName,
      confidence_score: aiResponse.confidence_score,
      confidence_level,
      topic_category,
      contains_financial_advice: aiResponse.intent === 'PERSONAL_FINANCE' || aiResponse.intent === 'TRANSACTION_ANALYSIS',
      contains_tax_advice: aiResponse.intent === 'TAX_QUERY' || aiResponse.intent === 'GST_QUERY',
      disclaimer_shown: aiResponse.disclaimer_required,
      disclaimer_text: aiResponse.disclaimer,
      reviewed_by_human: false, // Rule: Never set to true automatically
      created_at: now,
    };

    // Compute tamper-evident HMAC signature
    const canonical = buildAuditCanonicalString(entry);
    entry.hmac_signature = generateAuditSignature(canonical);

    // Store in-memory for immediate test verification
    inMemoryAuditLogs.push(entry);

    // Try Supabase Admin persistence
    try {
      const supabase = getSupabaseAdminClient();
      await supabase.from('ai_recommendations_log').insert({
        id: entry.id,
        user_id: entry.user_id,
        conversation_id: entry.conversation_id || null,
        query: entry.query,
        response: entry.response,
        model_used: entry.model_used,
        confidence_score: entry.confidence_score,
        confidence_level: entry.confidence_level,
        topic_category: entry.topic_category,
        contains_financial_advice: entry.contains_financial_advice,
        contains_tax_advice: entry.contains_tax_advice,
        disclaimer_shown: entry.disclaimer_shown,
        disclaimer_text: entry.disclaimer_text || null,
        reviewed_by_human: false,
        created_at: entry.created_at,
      });
    } catch (e) {
      // Fallback
    }

    return entry;
  }
}

export const auditLogger = new AuditLogger();
