import { v4 as uuidv4 } from 'uuid';
import { AIProvider } from './providers/aiProvider.interface.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { OpenAICompatibleProvider } from './providers/openaiCompatible.provider.js';
import { FallbackAIProvider } from './providers/fallback.provider.js';
import { MockAIProvider } from './providers/mock.provider.js';
import { classifyIntent } from './classification/intentClassifier.js';
import { safetyPolicyEngine } from './classification/safetyPolicy.js';
import { retrievalService } from './retrieval/retrieval.service.js';
import { contextPackager } from './retrieval/contextPackager.js';
import { SYSTEM_INSTRUCTION, buildPrompt } from './prompts/promptTemplates.js';
import { groundingValidator } from './evaluation/groundingValidator.js';
import { confidenceEngine } from './evaluation/confidenceEngine.js';
import { auditLogger } from './audit/auditLogger.js';
import { AIStructuredResponse } from './schemas/aiResponse.schema.js';
import { env } from '../../config/env.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../middleware/errorHandler.js';

export interface ProcessChatOptions {
  conversationId?: string;
}

interface CachedAIResponse {
  response: AIStructuredResponse & { conversation_id: string };
  timestamp: number;
}

export class AIService {
  private groqProvider: OpenAICompatibleProvider;
  private geminiProvider: GeminiProvider;
  private fallbackProvider: FallbackAIProvider;
  private mockProvider: MockAIProvider;
  private activeProvider: AIProvider;
  private queryCache: Map<string, CachedAIResponse> = new Map();
  private readonly CACHE_TTL_MS = 60 * 1000; // 60s user-isolated TTL

  constructor() {
    this.mockProvider = new MockAIProvider();
    this.geminiProvider = new GeminiProvider();

    // TIER 1 — PRIMARY AI PROVIDER (Groq)
    const effectiveGroqKey = process.env.GROQ_API_KEY || '';
    this.groqProvider = new OpenAICompatibleProvider({
      apiKey: effectiveGroqKey,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: env.GROQ_MODEL,
      providerName: 'Groq',
    });

    // TIER 2 — OPTIONAL FAILOVER AI PROVIDER (Google Gemini)
    // Orchestrator: Groq (Primary) -> Gemini (Failover)
    this.fallbackProvider = new FallbackAIProvider(
      this.groqProvider,
      this.geminiProvider
    );

    // DETERMINISTIC PROVIDER SELECTION:
    // 1. If GROQ_API_KEY is configured and valid, Groq MUST be selected as Tier 1 Primary (with Gemini as failover if configured).
    // 2. If Groq is not configured, check if Gemini alone is configured (Tier 2).
    // 3. MockAIProvider is strictly for development/test mode (Tier 3).
    // In production, if neither external provider is configured, fail closed.
    const isProduction = process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production';
    if (this.groqProvider.isAvailable()) {
      this.activeProvider = this.fallbackProvider;
    } else if (this.geminiProvider.isAvailable()) {
      this.activeProvider = this.geminiProvider;
    } else if (isProduction) {
      this.activeProvider = {
        getModelName: () => 'unconfigured-provider',
        isAvailable: () => false,
        generateStructuredResponse: async () => {
          throw new AppError('No AI provider configured in production environment. Failing closed.', 503, 'AI_PROVIDER_UNAVAILABLE');
        },
      };
    } else {
      this.activeProvider = this.mockProvider;
    }
  }

  setProvider(provider: AIProvider) {
    this.activeProvider = provider;
  }

  getProvider(): AIProvider {
    return this.activeProvider;
  }

  getMockProvider(): MockAIProvider {
    return this.mockProvider;
  }

  async processUserMessage(
    userId: string,
    query: string,
    options?: ProcessChatOptions
  ): Promise<AIStructuredResponse & { conversation_id: string }> {
    if (!userId) {
      throw new Error('Authenticated user context required');
    }

    const conversationId = options?.conversationId || uuidv4();
    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `${userId}:${normalizedQuery}`;

    // Check user-scoped cache (NEVER cross-user)
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return {
        ...cached.response,
        conversation_id: conversationId,
      };
    }

    // 1. Intent & Risk Classification
    const classification = classifyIntent(query);

    // 2. Pre-Generation Safety Policy Check (Deterministic refusals)
    const policyRefusal = safetyPolicyEngine.evaluatePreGenerationPolicy(classification);
    if (policyRefusal) {
      // Store in audit log and return immediately
      await auditLogger.logRecommendation(
        userId,
        query,
        policyRefusal,
        this.activeProvider.getModelName(),
        conversationId
      );
      await this.persistConversationMessages(userId, conversationId, query, policyRefusal.answer);

      return {
        ...policyRefusal,
        conversation_id: conversationId,
      };
    }

    // 3. RAG Retrieval: Strictly user-scoped data retrieval
    const retrievedContext = await retrievalService.retrieveContext(userId, query, classification.intent);

    // 4. Context Packaging & Minimization with Injection Barriers
    const packagedPrompt = contextPackager.packagePromptContext(query, retrievedContext);
    const fullPrompt = buildPrompt(packagedPrompt);

    // 5. Invoke Model Provider (with automatic primary -> Groq fallback)
    let modelResponse: AIStructuredResponse;
    try {
      modelResponse = await this.activeProvider.generateStructuredResponse(fullPrompt, {
        temperature: 0.1,
        systemInstruction: SYSTEM_INSTRUCTION,
      });
    } catch (err: any) {
      throw err;
    }

    // 6. Grounding & Calculation Validation
    let validatedResponse = groundingValidator.validateGrounding(modelResponse, retrievedContext);

    // 7. Multi-factor Application-Level Confidence Calculation
    validatedResponse.confidence_score = confidenceEngine.assessConfidence(validatedResponse, retrievedContext);

    // 8. Enforce Mandatory Centralized Disclaimers
    const mandatoryDisclaimer = safetyPolicyEngine.getMandatoryDisclaimer(validatedResponse.intent);
    if (mandatoryDisclaimer.required) {
      validatedResponse.disclaimer_required = true;
      validatedResponse.disclaimer = mandatoryDisclaimer.text;
    }

    // 9. Human Review Gate: Mandatory for HIGH, CRITICAL, UNKNOWN risk or low confidence
    if (
      validatedResponse.risk_level === 'HIGH' ||
      validatedResponse.risk_level === 'CRITICAL' ||
      validatedResponse.risk_level === 'UNKNOWN' ||
      validatedResponse.confidence_score < 0.60
    ) {
      validatedResponse.human_review_required = true;
    }

    // 10. Persist to Conversation and Conversation Messages
    await this.persistConversationMessages(userId, conversationId, query, validatedResponse.answer);

    // 11. Write Audit Log
    await auditLogger.logRecommendation(
      userId,
      query,
      validatedResponse,
      this.activeProvider.getModelName(),
      conversationId
    );

    const finalResponse = {
      ...validatedResponse,
      conversation_id: conversationId,
    };

    // Store in user-scoped cache
    this.queryCache.set(cacheKey, {
      response: finalResponse,
      timestamp: Date.now(),
    });

    return finalResponse;
  }

  private async persistConversationMessages(
    userId: string,
    conversationId: string,
    userQuery: string,
    aiAnswer: string
  ) {
    try {
      const supabase = getSupabaseAdminClient();

      await supabase
        .from('conversations')
        .upsert(
          {
            id: conversationId,
            user_id: userId,
            title: userQuery.slice(0, 50),
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      await supabase.from('conversation_messages').insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        content: userQuery,
        created_at: new Date().toISOString(),
      });

      await supabase.from('conversation_messages').insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: aiAnswer,
        created_at: new Date().toISOString(),
      });
    } catch (e: any) {
      // PRODUCTION HARDENING: Log persistence failures instead of silently swallowing them.
      // Conversation persistence is non-fatal (AI response still returned), but silent
      // data loss in production must be visible in logs.
      console.error(`[AI_SERVICE] Conversation persistence failed for user=${userId} conversation=${conversationId}: ${e.message || e}`);
    }
  }
}

export const aiService = new AIService();
