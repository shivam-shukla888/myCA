import { KnowledgeChunkRecord, KnowledgeSourceRecord } from '../knowledge.schema.js';
import { GroundedChunkResult } from './rag.schema.js';
import { NormalizedQuery } from './queryNormalizer.js';

export class RankingEngine {
  /**
   * Evaluates text relevance, authority tier, jurisdiction match, and recency
   * to compute a composite, grounded ranking score for every candidate chunk.
   */
  scoreChunk(
    chunk: KnowledgeChunkRecord,
    source: KnowledgeSourceRecord,
    query: NormalizedQuery,
    targetJurisdiction = 'IN'
  ): GroundedChunkResult {
    // 1. Text Relevance Score (Keyword density + headline/topic weighting)
    const relevanceScore = this.computeTextRelevance(chunk, source, query.tokens);

    // 2. Authority Score (with strict regulatory override)
    const authorityScore = this.computeAuthorityScore(source.authority_level, query.isRegulatoryOrTax);

    // 3. Jurisdiction Score (penalizing foreign sources for domestic regulatory/tax queries)
    const jurisdictionScore = this.computeJurisdictionScore(
      source.country,
      targetJurisdiction,
      query.isRegulatoryOrTax
    );

    // 4. Recency Score (penalizing stale/old sources for rapidly changing rules)
    const recencyScore = this.computeRecencyScore(
      source.last_verified_at || source.publication_date,
      query.isRegulatoryOrTax
    );

    // 5. Final Composite Score
    const finalScore = Math.round(relevanceScore * authorityScore * jurisdictionScore * recencyScore * 1000) / 1000;

    return {
      chunk_id: chunk.chunk_id,
      source_id: source.source_id,
      source_title: source.title,
      author_or_organization: source.author_or_organization,
      source_type: source.source_type,
      source_version: chunk.source_version,
      authority_level: source.authority_level,
      country: source.country,
      publication_date: source.publication_date,
      last_verified_at: source.last_verified_at,
      canonical_url: source.canonical_url,
      license_status: source.license_status,
      chunk_type: chunk.chunk_type,
      headline: chunk.headline,
      content: chunk.content,
      citation_page_or_section: chunk.citation_page_or_section,
      is_summary: chunk.is_summary,
      summary_attribution: chunk.summary_attribution,
      relevance_score: Math.round(relevanceScore * 100) / 100,
      authority_score: authorityScore,
      jurisdiction_score: jurisdictionScore,
      recency_score: recencyScore,
      final_score: finalScore,
    };
  }

  private computeTextRelevance(
    chunk: KnowledgeChunkRecord,
    source: KnowledgeSourceRecord,
    tokens: string[]
  ): number {
    if (tokens.length === 0) return 0.1;

    const headlineLower = chunk.headline.toLowerCase();
    const contentLower = chunk.content.toLowerCase();
    const topicLower = source.topic.toLowerCase();
    const titleLower = source.title.toLowerCase();

    let matchedTokens = 0;
    let weightSum = 0;

    for (const token of tokens) {
      let tokenFound = false;

      // Headline matches carry highest relevance (weight 3.0)
      if (headlineLower.includes(token)) {
        tokenFound = true;
        weightSum += 3.0;
      }
      // Topic matches carry strong relevance (weight 2.0)
      if (topicLower.includes(token)) {
        tokenFound = true;
        weightSum += 2.0;
      }
      // Title matches (weight 1.5)
      if (titleLower.includes(token)) {
        tokenFound = true;
        weightSum += 1.5;
      }
      // Content matches (weight 1.0)
      if (contentLower.includes(token)) {
        tokenFound = true;
        weightSum += 1.0;
      }

      if (tokenFound) matchedTokens++;
    }

    // Token coverage ratio (what proportion of query keywords appeared)
    const coverage = matchedTokens / tokens.length;
    const densityBoost = Math.min(weightSum / (tokens.length * 3.0), 1.0);

    return Math.min(coverage * 0.6 + densityBoost * 0.4, 1.0);
  }

  private computeAuthorityScore(tier: number, isRegulatoryOrTax: boolean): number {
    // When query is regulatory or tax-related, Tier 1 is overwhelmingly prioritized
    if (isRegulatoryOrTax) {
      switch (tier) {
        case 1:
          return 2.5; // Official Regulatory / Govt
        case 2:
          return 1.4; // Primary Academic Research
        case 3:
          return 1.1; // Established Institutional
        case 4:
          return 0.35; // Old/General Book heavily discounted
        case 5:
          return 0.2; // Podcast/media heavily discounted
        default:
          return 0.1;
      }
    }

    // Standard authority weights for educational / behavioral / general planning queries
    switch (tier) {
      case 1:
        return 2.0;
      case 2:
        return 1.6;
      case 3:
        return 1.4;
      case 4:
        return 1.2;
      case 5:
        return 0.9;
      default:
        return 0.7;
    }
  }

  private computeJurisdictionScore(
    sourceCountry: string,
    targetJurisdiction: string,
    isRegulatoryOrTax: boolean
  ): number {
    const isMatch = sourceCountry.toUpperCase() === targetJurisdiction.toUpperCase();

    if (isMatch) {
      return 1.4; // Domestic jurisdiction boost
    }

    // If query is specifically about domestic regulations or taxes, foreign sources are heavily penalized
    if (isRegulatoryOrTax) {
      return 0.25;
    }

    // General behavioral finance or global economic theory transfers across jurisdictions
    return 0.85;
  }

  private computeRecencyScore(dateString: string | undefined, isRegulatoryOrTax: boolean): number {
    if (!dateString) return 0.8;

    const sourceDate = new Date(dateString).getTime();
    if (isNaN(sourceDate)) return 0.8;

    const ageInMonths = (Date.now() - sourceDate) / (1000 * 60 * 60 * 24 * 30.4375);

    if (isRegulatoryOrTax) {
      if (ageInMonths <= 12) return 1.3; // Verified in last year
      if (ageInMonths <= 36) return 1.0; // 1-3 years old
      if (ageInMonths <= 60) return 0.6; // 3-5 years old
      return 0.3; // > 5 years old regulatory rule heavily decayed
    }

    // General educational / psychology principles hold over time
    if (ageInMonths <= 24) return 1.1;
    if (ageInMonths <= 120) return 1.0;
    return 0.9;
  }
}

export const rankingEngine = new RankingEngine();
