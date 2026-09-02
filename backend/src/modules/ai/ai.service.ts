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

export interface ProcessChatOptions {
  conversationId?: string;
}

interface CachedAIResponse {
  response: AIStructuredResponse & { conversation_id: string };
  timestamp: number;
}

export class AIService {
  private primaryProvider: OpenAICompatibleProvider;
  private groqFallbackProvider: OpenAICompatibleProvider;
  private geminiProvider: GeminiProvider;
  private fallbackProvider: FallbackAIProvider;
  private mockProvider: MockAIProvider;
  private activeProvider: AIProvider;
  private queryCache: Map<string, CachedAIResponse> = new Map();
  private readonly CACHE_TTL_MS = 60 * 1000; // 60s user-isolated TTL

  constructor() {
    this.geminiProvider = new GeminiProvider();
    this.mockProvider = new MockAIProvider();

    // 1. Primary AI Provider (SambaNova / Custom endpoint)
    this.primaryProvider = new OpenAICompatibleProvider({
      apiKey: env.PRIMARY_AI_API_KEY,
      baseUrl: env.PRIMARY_AI_BASE_URL,
      model: env.PRIMARY_AI_MODEL,
      providerName: 'PrimaryAI',
    });

    // 2. Fallback AI Provider (Groq)
    this.groqFallbackProvider = new OpenAICompatibleProvider({
      apiKey: env.GROQ_API_KEY,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: env.GROQ_MODEL,
      providerName: 'Groq',
    });

    // 3. Fallback Orchestrator: Primary -> Groq
    this.fallbackProvider = new FallbackAIProvider(
      this.primaryProvider,
      this.groqFallbackProvider
    );

    // Prioritize fallback provider if Groq or Primary is configured
    if (this.fallbackProvider.isAvailable()) {
      this.activeProvider = this.fallbackProvider;
    } else if (this.geminiProvider.isAvailable()) {
      this.activeProvider = this.geminiProvider;
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

    // 9. Human Review Gate
    if (
      validatedResponse.risk_level === 'HIGH' ||
      validatedResponse.risk_level === 'CRITICAL' ||
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
    } catch (e) {
      // Non-fatal if database tables are in fallback mode
    }
  }
}

export const aiService = new AIService();
