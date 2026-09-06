import { v4 as uuidv4 } from 'uuid';
import { AIProvider } from '../providers/aiProvider.interface.js';
import { OpenAICompatibleProvider } from '../providers/openaiCompatible.provider.js';
import { GeminiProvider } from '../providers/gemini.provider.js';
import { FallbackAIProvider } from '../providers/fallback.provider.js';
import { MockAIProvider } from '../providers/mock.provider.js';
import { classifyIntent } from '../classification/intentClassifier.js';
import { safetyPolicyEngine } from '../classification/safetyPolicy.js';
import { retrievalService, RetrievedContext } from '../retrieval/retrieval.service.js';
import { financialContextService } from '../financialContext.service.js';
import { croreService } from '../../crore/crore.service.js';
import { ragRetrievalEngine } from '../../knowledge/retrieval/ragRetrievalEngine.js';
import { RetrievalCategory, RetrievalResult } from '../../knowledge/retrieval/rag.schema.js';
import { contextBuilder } from './contextBuilder.js';
import { statementClassifier } from './statementClassifier.js';
import { groundingValidator } from '../evaluation/groundingValidator.js';
import { confidenceEngine } from '../evaluation/confidenceEngine.js';
import { securityGuard } from './securityGuard.js';
import { auditLogger } from '../audit/auditLogger.js';
import { aiObservability, AIErrorCategory } from '../observability/aiObservability.js';
import {
  OrchestratedAnswerRequest,
  OrchestratedAnswerResponse,
} from './answerOrchestrator.schema.js';
import { AIStructuredResponse, IntentCategory } from '../schemas/aiResponse.schema.js';
import { env } from '../../../config/env.js';
import { getSupabaseAdminClient } from '../../../config/supabase.js';
import { AppError } from '../../../middleware/errorHandler.js';

export class AnswerOrchestratorService {
  private primaryProvider: OpenAICompatibleProvider;
  private geminiProvider: GeminiProvider;
  private fallbackProvider: FallbackAIProvider;
  private mockProvider: MockAIProvider;
  private activeProvider: AIProvider;

  constructor() {
    this.mockProvider = new MockAIProvider();
    this.geminiProvider = new GeminiProvider();

    // Primary: Groq with openai/gpt-oss-120b
    const groqKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY || '';
    this.primaryProvider = new OpenAICompatibleProvider({
      apiKey: groqKey,
      baseUrl: process.env.PRIMARY_AI_BASE_URL || env.PRIMARY_AI_BASE_URL || 'https://api.groq.com/openai/v1',
      model: process.env.PRIMARY_AI_MODEL || env.PRIMARY_AI_MODEL || env.GROQ_MODEL || 'openai/gpt-oss-120b',
      providerName: 'Groq',
    });

    // Tier 1 (Groq) -> Tier 2 (Gemini)
    this.fallbackProvider = new FallbackAIProvider(
      this.primaryProvider,
      this.geminiProvider
    );

    const isProduction = process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production';
    if (this.primaryProvider.isAvailable()) {
      this.activeProvider = this.fallbackProvider;
    } else if (this.geminiProvider.isAvailable()) {
      this.activeProvider = this.geminiProvider;
    } else if (isProduction) {
      this.activeProvider = {
        getModelName: () => 'unconfigured-provider',
        isAvailable: () => false,
        generateStructuredResponse: async () => {
          throw new AppError(
            'No AI provider configured in production environment. Failing closed.',
            503,
            'AI_PROVIDER_UNAVAILABLE'
          );
        },
      };
    } else {
      this.activeProvider = this.mockProvider;
    }
  }

  setProvider(provider: AIProvider): void {
    this.activeProvider = provider;
  }

  getProvider(): AIProvider {
    return this.activeProvider;
  }

  getPrimaryProvider(): OpenAICompatibleProvider {
    return this.primaryProvider;
  }

  getMockProvider(): MockAIProvider {
    return this.mockProvider;
  }

  /**
   * The Core 9-Stage Orchestration Pipeline:
   * 1. INTENT CLASSIFICATION
   * 2. RISK CLASSIFICATION & PRE-GEN SAFETY
   * 3. RETRIEVE USER FINANCIAL CONTEXT
   * 4. RETRIEVE KNOWLEDGE
   * 5. DETERMINISTIC CALCULATIONS
   * 6. CURRENT-FACT VERIFICATION IF NEEDED
   * 7. STRUCTURED LLM GENERATION
   * 8. VALIDATION & STATEMENT CLASSIFICATION
   * 9. FINAL ANSWER & AUDIT LOGGING
   */
  async orchestrate(request: OrchestratedAnswerRequest): Promise<OrchestratedAnswerResponse> {
    const startTime = Date.now();
    const { userId, query } = request;
    const conversationId = request.conversationId || uuidv4();
    const timestamp = new Date().toISOString();

    if (!userId) {
      throw new Error('Authenticated user context required for answer orchestration');
    }

    const effectiveProvider = request.provider || this.activeProvider;

    // -------------------------------------------------------------------------
    // STAGE 1: INTENT CLASSIFICATION
    // -------------------------------------------------------------------------
    const classification = classifyIntent(query);

    // -------------------------------------------------------------------------
    // STAGE 2: RISK CLASSIFICATION, PROMPT EXTRACTION & PRE-GENERATION SAFETY
    // -------------------------------------------------------------------------
    const extractionCheck = securityGuard.detectPromptExtraction(query);
    if (extractionCheck.isExtraction) {
      const refusalAnswer = securityGuard.getExtractionRefusalAnswer();
      const { statements, breakdown } = statementClassifier.classifyResponse(refusalAnswer);
      const extractionRefusal: OrchestratedAnswerResponse = {
        answer: refusalAnswer,
        intent: 'GENERAL_FINANCE',
        risk_level: 'MEDIUM',
        confidence_score: 1.0,
        reasoning_breakdown: breakdown,
        statements,
        evidence: [],
        missing_information: [],
        disclaimer_required: false,
        disclaimer: '',
        human_review_required: false,
        refusal_or_limitation: 'System prompt extraction refused by security governance policy.',
        provider_used: effectiveProvider.getModelName(),
        conversation_id: conversationId,
        timestamp,
      };

      aiObservability.logPipelineEvent({
        request_id: conversationId,
        user_id: userId,
        intent: 'SYSTEM_SECURITY',
        risk_level: 'CRITICAL',
        retrieved_source_ids: [],
        retrieval_confidence: 0,
        calculation_ids: [],
        verification_status: 'NOT_APPLICABLE',
        validator_status: 'PASS',
        confidence_level: 'high',
        provider: effectiveProvider.getModelName(),
        model: effectiveProvider.getModelName(),
        latency_ms: Date.now() - startTime,
        retry_count: 0,
        error_category: 'SAFETY_BLOCK',
        failure_reason: 'System prompt extraction refused by security governance policy.',
        timestamp,
      });

      await this.persistMessages(userId, conversationId, query, refusalAnswer);
      return extractionRefusal;
    }

    const policyRefusal = safetyPolicyEngine.evaluatePreGenerationPolicy(classification);
    if (policyRefusal) {
      const { statements, breakdown } = statementClassifier.classifyResponse(policyRefusal.answer);
      const refusalResponse: OrchestratedAnswerResponse = {
        answer: policyRefusal.answer,
        intent: policyRefusal.intent,
        risk_level: policyRefusal.risk_level,
        confidence_score: policyRefusal.confidence_score,
        reasoning_breakdown: breakdown,
        statements,
        evidence: policyRefusal.evidence,
        missing_information: policyRefusal.missing_information,
        disclaimer_required: policyRefusal.disclaimer_required,
        disclaimer: policyRefusal.disclaimer,
        human_review_required: policyRefusal.human_review_required,
        refusal_or_limitation: policyRefusal.refusal_or_limitation,
        provider_used: effectiveProvider.getModelName(),
        conversation_id: conversationId,
        timestamp,
      };

      aiObservability.logPipelineEvent({
        request_id: conversationId,
        user_id: userId,
        intent: policyRefusal.intent,
        risk_level: policyRefusal.risk_level,
        retrieved_source_ids: [],
        retrieval_confidence: 0,
        calculation_ids: [],
        verification_status: 'NOT_APPLICABLE',
        validator_status: 'PASS',
        confidence_level: 'high',
        provider: effectiveProvider.getModelName(),
        model: effectiveProvider.getModelName(),
        latency_ms: Date.now() - startTime,
        retry_count: 0,
        error_category: 'SAFETY_BLOCK',
        failure_reason: policyRefusal.refusal_or_limitation || 'Pre-generation safety policy refusal',
        timestamp,
      });

      await auditLogger.logRecommendation(
        userId,
        query,
        policyRefusal,
        effectiveProvider.getModelName(),
        conversationId
      );
      await this.persistMessages(userId, conversationId, query, policyRefusal.answer);

      return refusalResponse;
    }

    // -------------------------------------------------------------------------
    // STAGE 3: RETRIEVE USER FINANCIAL CONTEXT (Deterministic Engine)
    // -------------------------------------------------------------------------
    const retrievedContext: RetrievedContext = await retrievalService.retrieveContext(
      userId,
      query,
      classification.intent
    );

    const financialContext =
      retrievedContext.deterministic_financial_context ||
      (await financialContextService.buildDeterministicContext(userId, request.targetMonth));

    // -------------------------------------------------------------------------
    // STAGE 4: RETRIEVE KNOWLEDGE (RAG Retrieval Engine)
    // -------------------------------------------------------------------------
    const ragCategory = this.mapIntentToRagCategory(classification.intent);
    let knowledgeResult: RetrievalResult | undefined;
    try {
      knowledgeResult = await ragRetrievalEngine.retrieve({
        query,
        category: ragCategory,
        max_chunks: 3,
        jurisdiction: 'IN',
      });
    } catch {
      knowledgeResult = undefined;
    }

    // -------------------------------------------------------------------------
    // STAGE 5: DETERMINISTIC CALCULATIONS & ₹1 CRORE INTEGRATION
    // -------------------------------------------------------------------------
    const deterministicCalculations: Record<string, any> = {
      income: financialContext.current_month.income,
      expenses: financialContext.current_month.expenses,
      surplus: financialContext.current_month.surplus,
      savings_rate: `${financialContext.current_month.savings_rate.toFixed(2)}%`,
    };

    if (financialContext.allocation) {
      deterministicCalculations.emergency_fund_target = financialContext.allocation.emergency_fund_target;
      deterministicCalculations.emergency_fund_gap = financialContext.allocation.emergency_gap;
    }

    if (financialContext.affordability) {
      deterministicCalculations.affordability_verdict = financialContext.affordability.verdict;
      deterministicCalculations.months_of_surplus_needed = financialContext.affordability.months_of_surplus_needed;
    }

    let croreAnalysis: any = null;
    const queryLowerForCrore = query.toLowerCase();
    const isCroreQuery =
      queryLowerForCrore.includes('1 crore') ||
      queryLowerForCrore.includes('1cr') ||
      queryLowerForCrore.includes('1 cr') ||
      queryLowerForCrore.includes('ek crore') ||
      queryLowerForCrore.includes('one crore') ||
      queryLowerForCrore.includes('kab banaunga') ||
      queryLowerForCrore.includes('kitne saal mein') ||
      queryLowerForCrore.includes('shortest path') ||
      queryLowerForCrore.includes('fastest path') ||
      queryLowerForCrore.includes('jaldi kaise');

    if (isCroreQuery) {
      try {
        const userCrore = await croreService.getUserCroreStatus(userId, request.targetMonth);
        croreAnalysis = userCrore.calculation;
        deterministicCalculations.crore_target = '₹1,00,00,000';
        deterministicCalculations.starting_capital = croreAnalysis.starting_capital;
        deterministicCalculations.current_monthly_contribution = croreAnalysis.current_monthly_contribution;
        deterministicCalculations.base_case_target_date = croreAnalysis.base_case.target_date || 'Unreachable within 60 years at current contribution';
        deterministicCalculations.base_case_months = croreAnalysis.base_case.months_to_target;
        deterministicCalculations.improved_case_target_date = croreAnalysis.improved_case.target_date;
        deterministicCalculations.shortest_modeled_path_date = croreAnalysis.shortest_modeled_path.target_date;
        deterministicCalculations.highest_impact_lever = croreAnalysis.lever_analysis.highest_impact_lever;
        deterministicCalculations.recommended_change = croreAnalysis.lever_analysis.recommended_change;
        deterministicCalculations.one_next_action = croreAnalysis.one_next_action;
      } catch {
        // Safe non-blocking
      }
    }

    // -------------------------------------------------------------------------
    // STAGE 6: CURRENT-FACT VERIFICATION IF NEEDED
    // -------------------------------------------------------------------------
    const isCurrentFactRequired = this.checkIfCurrentFactRequired(query, classification.intent);
    let currentFactStatus: {
      required: boolean;
      isVerified: boolean;
      factType?: string;
      sourceTitle?: string;
      sourceAuthority?: number;
      details?: string;
      status: 'VERIFIED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_APPLICABLE';
    } = {
      required: isCurrentFactRequired,
      isVerified: false,
      status: isCurrentFactRequired ? 'INSUFFICIENT_EVIDENCE' : 'NOT_APPLICABLE',
    };

    if (isCurrentFactRequired) {
      // If query inquires about a specific statutory section (e.g. section 80C, section 999XYZ),
      // ensure the retrieved chunk actually references that specific provision.
      const queryLower = query.toLowerCase();
      const sectionMatch = query.match(/section\s+([0-9a-z]+)/i);
      const targetSection = sectionMatch ? sectionMatch[1].toLowerCase() : null;

      const verifiedChunk = knowledgeResult?.chunks.find((c) => {
        if (c.authority_level > 2 || c.country !== 'IN') return false;
        const chunkText = (c.content + ' ' + (c.citation_page_or_section || '') + ' ' + (c.headline || '') + ' ' + c.source_title).toLowerCase();

        if (targetSection) {
          return chunkText.includes(targetSection);
        }

        // Specific statutory topic gating: chunk must match the specific domain of inquiry
        if (queryLower.includes('property tax') || queryLower.includes('municipal')) {
          return chunkText.includes('property tax') || chunkText.includes('municipal');
        }
        if (queryLower.includes('stamp duty') || queryLower.includes('ancestral')) {
          return chunkText.includes('stamp duty');
        }
        if (queryLower.includes('deposit insurance') || queryLower.includes('dicgc') || queryLower.includes('bank fail')) {
          return chunkText.includes('dicgc') || chunkText.includes('deposit') || chunkText.includes('insurance');
        }
        if (queryLower.includes('adviser') || queryLower.includes('fee cap') || queryLower.includes('sebi')) {
          return chunkText.includes('adviser') || chunkText.includes('fee') || chunkText.includes('sebi');
        }
        if (queryLower.includes('87a') || queryLower.includes('rebate')) {
          return chunkText.includes('87a') || chunkText.includes('rebate');
        }
        if (queryLower.includes('standard deduction') || queryLower.includes('115bac')) {
          return chunkText.includes('standard deduction') || chunkText.includes('75,000') || chunkText.includes('115bac');
        }
        if (queryLower.includes('80c')) {
          return chunkText.includes('80c');
        }
        if (queryLower.includes('80d')) {
          return chunkText.includes('80d');
        }

        return true;
      });

      if (verifiedChunk) {
        currentFactStatus = {
          required: true,
          isVerified: true,
          factType: classification.intent,
          sourceTitle: verifiedChunk.source_title,
          sourceAuthority: verifiedChunk.authority_level,
          details: verifiedChunk.content,
          status: 'VERIFIED',
        };
      } else {
        currentFactStatus = {
          required: true,
          isVerified: false,
          factType: classification.intent,
          status: 'INSUFFICIENT_EVIDENCE',
        };
      }
    }

    // FAIL-CLOSED: If current regulatory or tax verification was required but no Tier 1/2 verified chunk exists,
    // NEVER allow LLM to invent an answer from general memory. Fail closed immediately.
    if (isCurrentFactRequired && !currentFactStatus.isVerified) {
      const refusalAnswer = "I don't have enough verified, authoritative information to answer this current regulatory or statutory question accurately. Under MyCA safety policy, statutory claims must be backed by official Tier 1/2 sources. Please consult the official Income Tax Department (incometax.gov.in), RBI (rbi.org.in), or SEBI (sebi.gov.in) portal.";

      const mandatoryDisclaimer = safetyPolicyEngine.getMandatoryDisclaimer(classification.intent);
      const disclaimerText = mandatoryDisclaimer.required
        ? mandatoryDisclaimer.text
        : 'DISCLAIMER: Authoritative current regulatory source verification could not be established.';

      const { statements, breakdown } = statementClassifier.classifyResponse(refusalAnswer);
      const detailedConfidence = confidenceEngine.assessConfidenceDetailed(
        {
          answer: refusalAnswer,
          intent: classification.intent,
          risk_level: 'HIGH',
          confidence_score: 0.10,
          evidence: [],
          missing_information: ['Authoritative current statutory source verification unavailable.'],
          disclaimer_required: true,
          disclaimer: disclaimerText,
          human_review_required: true,
          refusal_or_limitation: 'INSUFFICIENT_EVIDENCE',
        },
        retrievedContext,
        {
          query,
          isCurrentFactRequired: true,
          currentFactVerified: false,
          retrievedChunksCount: 0,
        }
      );

      const refusalResponse: OrchestratedAnswerResponse = {
        answer: refusalAnswer,
        intent: classification.intent,
        risk_level: 'HIGH',
        confidence_score: detailedConfidence.overall_confidence,
        confidence_breakdown: detailedConfidence,
        reasoning_breakdown: breakdown,
        statements,
        evidence: [],
        verified_facts: [],
        deterministic_calculations: deterministicCalculations,
        missing_information: ['Authoritative current regulatory source verification unavailable.'],
        disclaimer_required: true,
        disclaimer: disclaimerText,
        human_review_required: true,
        refusal_or_limitation: 'INSUFFICIENT_EVIDENCE',
        provider_used: effectiveProvider.getModelName(),
        conversation_id: conversationId,
        timestamp,
      };

      aiObservability.logPipelineEvent({
        request_id: conversationId,
        user_id: userId,
        intent: classification.intent,
        risk_level: 'HIGH',
        retrieved_source_ids: [],
        retrieval_confidence: 0,
        calculation_ids: Object.keys(deterministicCalculations),
        verification_status: 'INSUFFICIENT_EVIDENCE',
        validator_status: 'PASS',
        confidence_level: 'very_low',
        provider: effectiveProvider.getModelName(),
        model: effectiveProvider.getModelName(),
        latency_ms: Date.now() - startTime,
        retry_count: 0,
        error_category: 'CURRENT_FACT_UNVERIFIED',
        failure_reason: 'Current regulatory verification failed; failed closed under fiduciary policy.',
        timestamp,
      });

      await this.persistMessages(userId, conversationId, query, refusalAnswer);
      return refusalResponse;
    }

    // -------------------------------------------------------------------------
    // STAGE 7: STRUCTURED PROMPT PACKAGING & LLM GENERATION
    // Never send raw user query directly to LLM without context processing.
    // -------------------------------------------------------------------------
    const structuredPrompt = contextBuilder.buildStructuredPrompt({
      query,
      intent: classification.intent,
      financialContext,
      knowledgeResult,
      currentFactStatus,
      deterministicCalculations,
      croreAnalysis,
    });

    let modelResponse: AIStructuredResponse;
    try {
      modelResponse = await effectiveProvider.generateStructuredResponse(structuredPrompt, {
        temperature: 0.1,
      });
    } catch (err: any) {
      aiObservability.logPipelineEvent({
        request_id: conversationId,
        user_id: userId,
        intent: classification.intent,
        risk_level: 'HIGH',
        retrieved_source_ids: knowledgeResult?.chunks.map((c) => c.chunk_id) || [],
        retrieval_confidence: knowledgeResult ? 0.9 : 0.0,
        calculation_ids: Object.keys(deterministicCalculations),
        verification_status: currentFactStatus.status,
        validator_status: 'SAFE_FAILURE',
        confidence_level: 'very_low',
        provider: effectiveProvider.getModelName(),
        model: effectiveProvider.getModelName(),
        latency_ms: Date.now() - startTime,
        retry_count: 0,
        error_category: 'AI_PROVIDER_FAILED',
        failure_reason: err.message || 'Unknown provider failure',
        timestamp,
      });
      if (err instanceof AppError) throw err;
      throw new AppError(
        `AI Orchestration provider failure: ${err.message || 'Unknown error'}`,
        503,
        'AI_ORCHESTRATION_FAILED'
      );
    }

    // -------------------------------------------------------------------------
    // STAGE 8: VALIDATION & STATEMENT CLASSIFICATION
    // -------------------------------------------------------------------------
    // Verify grounding against financial context and deterministic calculations
    const validated = groundingValidator.validateGrounding(modelResponse, retrievedContext);

    // Calculate multi-factor application confidence score
    const detailedConfidence = confidenceEngine.assessConfidenceDetailed(validated, retrievedContext, {
      query,
      isCurrentFactRequired,
      currentFactVerified: currentFactStatus.isVerified,
      retrievedChunksCount: knowledgeResult?.chunks.length || 0,
      topAuthorityLevel: knowledgeResult?.chunks[0]?.authority_level,
      hasVerifiedRegulatoryEvidence: currentFactStatus.isVerified,
      validatorStatus: validated.human_review_required ? 'REGENERATE' : 'PASS',
    });
    validated.confidence_score = detailedConfidence.overall_confidence;

    // Enforce mandatory statutory disclaimers (SEBI / Income Tax Act)
    const disclaimerCheck = safetyPolicyEngine.getMandatoryDisclaimer(validated.intent);
    if (disclaimerCheck.required) {
      validated.disclaimer_required = true;
      validated.disclaimer = disclaimerCheck.text;
    }

    // Human review gate
    if (
      validated.risk_level === 'HIGH' ||
      validated.risk_level === 'CRITICAL' ||
      validated.confidence_score < 0.60
    ) {
      validated.human_review_required = true;
    }

    // Stage 8.5: Zero-Trust Output Secret Sanitization
    const sanitizedOutput = securityGuard.scanAndSanitizeOutput(validated.answer);
    validated.answer = sanitizedOutput.sanitized;

    // Classify statements into FACT, CALCULATION, ASSUMPTION, INTERPRETATION, GENERAL_GUIDANCE
    const { statements, breakdown } = statementClassifier.classifyResponse(validated.answer, {
      knownCalculations: deterministicCalculations,
      verifiedSources: knowledgeResult?.chunks.map((c) => c.source_title),
    });

    // -------------------------------------------------------------------------
    // STAGE 9: FINAL STRUCTURED ANSWER & AUDIT LOGGING
    // -------------------------------------------------------------------------
    await this.persistMessages(userId, conversationId, query, validated.answer);

    await auditLogger.logRecommendation(
      userId,
      query,
      validated,
      effectiveProvider.getModelName(),
      conversationId
    );

    const latencyMs = Date.now() - startTime;
    let errorCategory: AIErrorCategory | undefined;
    if (isCurrentFactRequired && !currentFactStatus.isVerified) {
      errorCategory = 'CURRENT_FACT_UNVERIFIED';
    } else if (validated.confidence_score < 0.45) {
      errorCategory = 'INSUFFICIENT_EVIDENCE';
    }

    aiObservability.logPipelineEvent({
      request_id: conversationId,
      user_id: userId,
      intent: validated.intent,
      risk_level: validated.risk_level,
      retrieved_source_ids: knowledgeResult?.chunks.map((c) => c.chunk_id) || [],
      retrieval_confidence: knowledgeResult ? 0.9 : 0.0,
      calculation_ids: Object.keys(deterministicCalculations),
      verification_status: currentFactStatus.status,
      validator_status: validated.human_review_required ? 'REGENERATE' : 'PASS',
      confidence_level:
        validated.confidence_score >= 0.85
          ? 'high'
          : validated.confidence_score >= 0.65
          ? 'medium'
          : validated.confidence_score >= 0.40
          ? 'low'
          : 'very_low',
      provider: effectiveProvider.getModelName(),
      model: effectiveProvider.getModelName(),
      latency_ms: latencyMs,
      retry_count: 0,
      error_category: errorCategory,
      failure_reason: validated.refusal_or_limitation || undefined,
      timestamp,
    });

    return {
      answer: validated.answer,
      intent: validated.intent,
      risk_level: validated.risk_level,
      confidence_score: validated.confidence_score,
      confidence_breakdown: detailedConfidence,
      reasoning_breakdown: breakdown,
      statements,
      evidence: validated.evidence,
      verified_facts: knowledgeResult?.chunks,
      deterministic_calculations: deterministicCalculations,
      missing_information: validated.missing_information,
      disclaimer_required: validated.disclaimer_required,
      disclaimer: validated.disclaimer,
      human_review_required: validated.human_review_required,
      refusal_or_limitation: validated.refusal_or_limitation,
      provider_used: this.activeProvider.getModelName(),
      conversation_id: conversationId,
      timestamp,
    };
  }

  private mapIntentToRagCategory(intent: string): RetrievalCategory {
    switch (intent) {
      case 'TAX_QUERY':
        return 'TAX';
      case 'INVESTMENT_EDUCATION':
        return 'INVESTING_EDUCATION';
      case 'PERSONAL_FINANCE':
        return 'PERSONAL_FINANCE';
      default:
        return 'CURRENT_REGULATION';
    }
  }

  private checkIfCurrentFactRequired(query: string, intent: IntentCategory): boolean {
    if (intent === 'TAX_QUERY') return true;
    return /\b(sebi|rbi|dicgc|income\s*tax|80c|80d|87a|115bac|standard\s*deduction|tax\s*slab|tax\s*rate|repo\s*rate|statutory\s*limit|regulatory\s*threshold|circular|regulation|regulations|master\s*direction|notification|amendment|official\s*rate|fee\s*cap|deposit\s*insurance|property\s*tax|municipal\s*tax|rebate)\b/i.test(
      query
    );
  }

  private async persistMessages(
    userId: string,
    conversationId: string,
    query: string,
    answer: string
  ): Promise<void> {
    try {
      const supabase = getSupabaseAdminClient();
      await supabase
        .from('conversations')
        .upsert(
          {
            id: conversationId,
            user_id: userId,
            title: query.slice(0, 50),
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      await supabase.from('conversation_messages').insert([
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: query,
          created_at: new Date().toISOString(),
        },
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: answer,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e: any) {
      console.warn(`[ORCHESTRATOR] Conversation message persistence non-fatal error: ${e.message}`);
    }
  }
}

export const answerOrchestratorService = new AnswerOrchestratorService();
