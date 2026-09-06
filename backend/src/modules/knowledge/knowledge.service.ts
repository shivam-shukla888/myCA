import { AppError } from '../../middleware/errorHandler.js';
import {
  IngestKnowledgeSourceInput,
  KnowledgeSourceRecord,
  KnowledgeChunkRecord,
  QueryKnowledgeSourceInput,
  SourceStatus,
  ChunkProvenance,
  AuthorityLevel,
} from './knowledge.schema.js';
import { knowledgeRepository, KnowledgeRepository } from './knowledge.repository.js';
import { knowledgeChunker, computeSha256, normalizeContent } from './ingestion/chunker.js';
import { injectionDetector } from './ingestion/injectionDetector.js';
import { ragRetrievalEngine } from './retrieval/ragRetrievalEngine.js';
import { RetrievalQuery, RetrievalResult } from './retrieval/rag.schema.js';

export class KnowledgeService {
  constructor(private repo: KnowledgeRepository = knowledgeRepository) {}

  /**
   * Ingests a new knowledge source or updates an existing source to a new version.
   * Enforces:
   * 1. Duplicate detection
   * 2. Copyright and licensing safety
   * 3. Prompt-injection defense
   * 4. Full provenance stamping (source_id, source_version, chunk_id)
   */
  async ingestSource(input: IngestKnowledgeSourceInput): Promise<KnowledgeSourceRecord> {
    // 1. Scan metadata for prompt injection
    const metaCheck = injectionDetector.detectInjection(`${input.title} ${input.description}`);
    if (metaCheck.hasInjection) {
      throw new AppError(
        `Malicious prompt injection detected in source metadata: ${metaCheck.patterns.join(', ')}`,
        400,
        'SECURITY_INJECTION_DETECTED'
      );
    }

    // 2. Validate Authority Hierarchy constraints
    if (input.authority_level < 1 || input.authority_level > 6) {
      throw new AppError('Authority level must be strictly between 1 (highest) and 6 (lowest).', 400, 'INVALID_AUTHORITY_LEVEL');
    }

    // Tier 1 is strictly for Official Regulatory / Government sources
    if (input.authority_level === 1 && input.source_type !== 'OFFICIAL_REGULATORY' && input.source_type !== 'GOVERNMENT') {
      throw new AppError(
        'Authority Level 1 is strictly reserved for OFFICIAL_REGULATORY or GOVERNMENT sources.',
        400,
        'INVALID_AUTHORITY_MAPPING'
      );
    }

    // 3. Check for existing source
    const existing = await this.repo.findSourceBySlug(input.source_id);

    // Compute overall content hash if content is supplied
    const rawNormalized = input.raw_content ? normalizeContent(input.raw_content) : '';
    const contentHash = rawNormalized ? computeSha256(rawNormalized) : undefined;

    if (existing) {
      // Check for duplicate ingestion
      if (existing.content_hash && existing.content_hash === contentHash && existing.title === input.title) {
        throw new AppError(
          `Source with id "${input.source_id}" and identical content already exists (version ${existing.version}). Duplicate ingestion prevented.`,
          409,
          'DUPLICATE_SOURCE'
        );
      }

      // If existing source is updated, increment version and create new versioned chunks
      const newVersion = existing.version + 1;

      // Process chunks for new version
      const newChunks = knowledgeChunker.processChunks({
        sourceDbId: existing.id,
        sourceSlug: input.source_id,
        sourceVersion: newVersion,
        licenseStatus: input.license_status,
        rawContent: input.raw_content,
        predefinedChunks: input.chunks,
      });

      const updated = await this.repo.updateSource(
        existing.id,
        {
          version: newVersion,
          title: input.title,
          author_or_organization: input.author_or_organization,
          source_type: input.source_type,
          topic: input.topic,
          country: input.country,
          publication_date: input.publication_date,
          last_verified_at: input.last_verified_at || new Date().toISOString(),
          authority_level: input.authority_level as AuthorityLevel,
          license_status: input.license_status,
          canonical_url: input.canonical_url,
          description: input.description,
          status: input.status || existing.status || 'ACTIVE',
          content_hash: contentHash,
        },
        newChunks
      );

      return updated;
    }

    // 4. Ingest Brand New Source
    // First, process chunks (will throw if prompt injection or copyright violation occurs)
    // We use a temporary dummy sourceDbId; repo assigns the real UUID on insert
    const chunks = knowledgeChunker.processChunks({
      sourceDbId: 'pending-id',
      sourceSlug: input.source_id,
      sourceVersion: 1,
      licenseStatus: input.license_status,
      rawContent: input.raw_content,
      predefinedChunks: input.chunks,
    });

    const newSource = await this.repo.insertSource(
      {
        source_id: input.source_id,
        version: 1,
        title: input.title,
        author_or_organization: input.author_or_organization,
        source_type: input.source_type,
        topic: input.topic,
        country: input.country,
        publication_date: input.publication_date,
        last_verified_at: input.last_verified_at || new Date().toISOString(),
        authority_level: input.authority_level as AuthorityLevel,
        license_status: input.license_status,
        canonical_url: input.canonical_url,
        description: input.description,
        status: input.status || 'ACTIVE',
        content_hash: contentHash,
      },
      chunks
    );

    return newSource;
  }

  /**
   * Updates source status (e.g. marking RETRACTED, OUTDATED, ARCHIVED)
   */
  async updateSourceStatus(sourceSlugOrId: string, status: SourceStatus, reason: string): Promise<KnowledgeSourceRecord> {
    let source = await this.repo.findSourceBySlug(sourceSlugOrId);
    if (!source) {
      source = await this.repo.findSourceById(sourceSlugOrId);
    }
    if (!source) {
      throw new AppError(`Knowledge source "${sourceSlugOrId}" not found`, 404, 'SOURCE_NOT_FOUND');
    }

    return await this.repo.updateSourceStatus(source.id, status);
  }

  /**
   * Lists knowledge sources with filtering
   */
  async listSources(query: QueryKnowledgeSourceInput) {
    return await this.repo.listSources(query);
  }

  /**
   * Retrieves a source by its canonical slug or UUID with all active chunks
   */
  async getSource(sourceSlugOrId: string, version?: number): Promise<KnowledgeSourceRecord> {
    let source = await this.repo.findSourceBySlug(sourceSlugOrId);
    if (!source) {
      source = await this.repo.findSourceById(sourceSlugOrId);
    }
    if (!source) {
      throw new AppError(`Knowledge source "${sourceSlugOrId}" not found`, 404, 'SOURCE_NOT_FOUND');
    }

    const chunks = await this.repo.getChunksForSource(source.id, version);
    return { ...source, chunks };
  }

  /**
   * Resolves the full provenance chain for a given chunk_id
   * Guarantees that every chunk is traceable back to its source, version, and authority tier
   */
  async getChunkProvenance(chunkId: string): Promise<ChunkProvenance> {
    const chunk = await this.repo.findChunkById(chunkId);
    if (!chunk) {
      throw new AppError(`Knowledge chunk "${chunkId}" not found`, 404, 'CHUNK_NOT_FOUND');
    }

    const source = await this.repo.findSourceById(chunk.source_id);
    if (!source) {
      throw new AppError(`Associated knowledge source not found for chunk "${chunkId}"`, 404, 'SOURCE_NOT_FOUND');
    }

    return {
      chunk_id: chunk.chunk_id,
      source_id: source.source_id,
      source_title: source.title,
      author_or_organization: source.author_or_organization,
      source_type: source.source_type,
      source_version: chunk.source_version,
      authority_level: source.authority_level,
      license_status: source.license_status,
      country: source.country,
      publication_date: source.publication_date,
      last_verified_at: source.last_verified_at,
      canonical_url: source.canonical_url,
      chunk_type: chunk.chunk_type,
      citation_page_or_section: chunk.citation_page_or_section,
      is_summary: chunk.is_summary,
      summary_attribution: chunk.summary_attribution,
      content_hash: chunk.content_hash,
    };
  }

  /**
   * Executes multi-stage production RAG retrieval with authority, jurisdiction, and recency ranking
   */
  async retrieveKnowledge(input: RetrievalQuery): Promise<RetrievalResult> {
    return await ragRetrievalEngine.retrieve(input);
  }
}

export const knowledgeService = new KnowledgeService();
