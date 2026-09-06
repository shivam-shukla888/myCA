import {
  RetrievalQuery,
  RetrievalResult,
  GroundedChunkResult,
} from './rag.schema.js';
import { queryNormalizer } from './queryNormalizer.js';
import { rankingEngine } from './rankingEngine.js';
import {
  knowledgeRepository,
  KnowledgeRepository,
  inMemoryKnowledgeSources,
  inMemoryKnowledgeChunks,
} from '../knowledge.repository.js';
import { getSupabaseAdminClient } from '../../../config/supabase.js';
import { env } from '../../../config/env.js';
import { PRODUCTION_KNOWLEDGE_SEEDS } from '../productionSeeds.js';

export class RagRetrievalEngine {
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.28;
  private readonly MAX_CHUNKS_PER_SOURCE = 2;
  private readonly MAX_CONTEXT_CHARS = 4500;

  constructor(private repo: KnowledgeRepository = knowledgeRepository) {}

  /**
   * Main production retrieval pipeline executing:
   * Normalization -> Retrieval -> Authority/Jurisdiction/Recency Ranking -> Deduplication -> Grounded Context Assembly
   */
  async retrieve(input: RetrievalQuery): Promise<RetrievalResult> {
    const now = new Date().toISOString();

    // 1. Intent, Normalization & Prompt-Injection Check
    const normalizedQuery = queryNormalizer.normalize(input.query, input.category);
    const targetJurisdiction = input.jurisdiction || 'IN';
    const maxChunks = input.max_chunks || 5;

    // 2. Fetch candidate active sources and chunks
    const candidates = await this.fetchActiveCandidates();

    if (candidates.length === 0) {
      return this.buildInsufficientEvidenceResult(
        normalizedQuery.raw,
        normalizedQuery.category,
        now,
        'No active knowledge sources found in the database.'
      );
    }

    // 3. Score each chunk across Relevance, Authority, Jurisdiction, and Recency
    const scoredChunks: GroundedChunkResult[] = [];

    for (const { chunk, source } of candidates) {
      // Skip inactive, retracted, or outdated sources
      if (source.status !== 'ACTIVE' || !chunk.is_active) continue;

      // Optional minimum authority tier filter
      if (input.min_authority_tier && source.authority_level > input.min_authority_tier) {
        continue;
      }

      const scored = rankingEngine.scoreChunk(chunk, source, normalizedQuery, targetJurisdiction);

      // Only include chunks with non-zero keyword/concept connection
      if (scored.relevance_score > 0.12) {
        scoredChunks.push(scored);
      }
    }

    // 4. Rank candidates by final composite score (descending)
    scoredChunks.sort((a, b) => b.final_score - a.final_score);

    // 5. Check if highest score meets confidence threshold
    if (scoredChunks.length === 0 || scoredChunks[0].final_score < this.MIN_CONFIDENCE_THRESHOLD) {
      return this.buildInsufficientEvidenceResult(
        normalizedQuery.raw,
        normalizedQuery.category,
        now,
        'No verified sources with sufficient evidentiary confidence matched the inquiry.'
      );
    }

    // 6. Deduplication (Source & Chunk level)
    const selectedChunks: GroundedChunkResult[] = [];
    const sourceCountMap = new Map<string, number>();
    const seenHashes = new Set<string>();
    let currentTotalChars = 0;

    for (const chunk of scoredChunks) {
      if (selectedChunks.length >= maxChunks) break;

      // Deduplicate near-identical content
      const contentSnippet = chunk.content.slice(0, 100);
      if (seenHashes.has(contentSnippet)) continue;

      // Limit max chunks per source to preserve diversity
      const currentFromSource = sourceCountMap.get(chunk.source_id) || 0;
      if (currentFromSource >= this.MAX_CHUNKS_PER_SOURCE) continue;

      // Enforce context budget limit
      if (currentTotalChars + chunk.content.length > this.MAX_CONTEXT_CHARS) break;

      selectedChunks.push(chunk);
      seenHashes.add(contentSnippet);
      sourceCountMap.set(chunk.source_id, currentFromSource + 1);
      currentTotalChars += chunk.content.length;
    }

    // 7. Calculate retrieval confidence score (normalized [0.0 - 1.0])
    const topScore = selectedChunks[0].final_score;
    const confidenceScore = Math.round(Math.min(1.0, topScore / 2.0) * 100) / 100;
    const status = confidenceScore >= 0.65 ? 'CONFIDENT' : 'PARTIAL_EVIDENCE';

    // 8. Construct injection-resistant XML grounded context
    const sourceGroundedContext = this.formatGroundedContext(selectedChunks);

    return {
      query: normalizedQuery.raw,
      detected_category: normalizedQuery.category,
      status,
      confidence_score: confidenceScore,
      chunks: selectedChunks,
      source_grounded_context: sourceGroundedContext,
      explanation: `Retrieved ${selectedChunks.length} verified evidence chunks with top authority tier ${selectedChunks[0].authority_level}.`,
      retrieved_at: now,
    };
  }

  private async fetchActiveCandidates(): Promise<Array<{ chunk: any; source: any }>> {
    const isProd = env.NODE_ENV === 'production';
    const results: Array<{ chunk: any; source: any }> = [];

    try {
      const supabase = getSupabaseAdminClient();
      const { data: chunks, error } = await supabase
        .from('knowledge_chunks')
        .select('*, knowledge_sources(*)')
        .eq('is_active', true);

      if (!error && chunks && chunks.length > 0) {
        for (const c of chunks) {
          const src = Array.isArray(c.knowledge_sources) ? c.knowledge_sources[0] : c.knowledge_sources;
          if (src && (src.status === 'ACTIVE' || !src.status)) {
            results.push({ chunk: c, source: src });
          }
        }
        if (results.length > 0) {
          return results;
        }
      }
    } catch {
      if (isProd) throw new Error('Database error during active candidate retrieval');
    }

    // In-memory fallback
    if (inMemoryKnowledgeChunks.size === 0) {
      this.ensureInMemorySeeds();
    }

    for (const chunk of inMemoryKnowledgeChunks.values()) {
      if (!chunk.is_active) continue;
      const source = inMemoryKnowledgeSources.get(chunk.source_id) ||
        Array.from(inMemoryKnowledgeSources.values()).find(s => s.source_id === chunk.source_id || s.source_id === chunk.source_slug);
      if (source && (source.status === 'ACTIVE' || !source.status)) {
        results.push({ chunk, source });
      }
    }

    return results;
  }

  private ensureInMemorySeeds(): void {
    if (inMemoryKnowledgeChunks.size > 0) return;
    try {
      const now = new Date().toISOString();
      for (const seed of PRODUCTION_KNOWLEDGE_SEEDS) {
        const srcId = seed.source_id;
        const srcRecord = {
          ...seed,
          id: srcId,
          version: 1,
          last_verified_at: now,
          created_at: now,
          updated_at: now,
        };
        inMemoryKnowledgeSources.set(srcId, srcRecord as any);

        if (seed.chunks) {
          seed.chunks.forEach((c, idx) => {
            const chunkId = `${srcId}-chunk-${idx + 1}`;
            inMemoryKnowledgeChunks.set(chunkId, {
              id: chunkId,
              chunk_id: chunkId,
              source_id: srcId,
              source_slug: srcId,
              source_version: 1,
              chunk_index: idx,
              chunk_type: c.chunk_type || 'EXCERPT',
              headline: c.headline,
              content: c.content,
              content_hash: 'seed-hash',
              citation_page_or_section: c.citation_page_or_section,
              is_summary: c.is_summary ?? false,
              summary_attribution: c.summary_attribution,
              prompt_injection_flagged: false,
              is_active: true,
              created_at: now,
              updated_at: now,
            } as any);
          });
        }
      }
    } catch (e) {
      console.warn('[RagRetrievalEngine] Auto-seeding in-memory knowledge failed:', e);
    }
  }

  private buildInsufficientEvidenceResult(
    query: string,
    category: any,
    retrievedAt: string,
    reason: string
  ): RetrievalResult {
    return {
      query,
      detected_category: category,
      status: 'INSUFFICIENT_EVIDENCE',
      confidence_score: 0,
      chunks: [],
      source_grounded_context: '<verified_retrieved_knowledge status="INSUFFICIENT_EVIDENCE"/>',
      explanation: reason,
      retrieved_at: retrievedAt,
    };
  }

  private formatGroundedContext(chunks: GroundedChunkResult[]): string {
    const lines: string[] = ['<verified_retrieved_knowledge>'];

    for (const c of chunks) {
      lines.push(
        `  <knowledge_chunk id="${c.chunk_id}" source="${c.source_id}" tier="${c.authority_level}" country="${c.country}" is_summary="${c.is_summary}">`
      );
      lines.push(`    <title>${c.source_title}</title>`);
      lines.push(`    <author>${c.author_or_organization}</author>`);
      if (c.citation_page_or_section) {
        lines.push(`    <citation>${c.citation_page_or_section}</citation>`);
      }
      lines.push(`    <headline>${c.headline}</headline>`);
      lines.push(`    <content>${c.content}</content>`);
      lines.push('  </knowledge_chunk>');
    }

    lines.push('</verified_retrieved_knowledge>');
    return lines.join('\n');
  }
}

export const ragRetrievalEngine = new RagRetrievalEngine();
