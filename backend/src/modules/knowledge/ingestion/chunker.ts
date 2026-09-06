import crypto from 'crypto';
import {
  ChunkType,
  IngestChunkItem,
  KnowledgeChunkRecord,
  LicenseStatus,
} from '../knowledge.schema.js';
import { injectionDetector } from './injectionDetector.js';
import { AppError } from '../../../middleware/errorHandler.js';

export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content.trim(), 'utf8').digest('hex');
}

export function normalizeContent(content: string): string {
  // Normalize Windows/Mac line breaks to LF, collapse trailing spaces per line,
  // but strictly preserve structure, paragraph breaks, and exact wording.
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export class KnowledgeChunker {
  /**
   * Processes pre-specified chunks or segments raw document text into provenance-stamped chunks
   */
  processChunks(params: {
    sourceDbId: string;
    sourceSlug: string;
    sourceVersion: number;
    licenseStatus: LicenseStatus;
    rawContent?: string;
    predefinedChunks?: IngestChunkItem[];
  }): Omit<KnowledgeChunkRecord, 'id' | 'created_at' | 'updated_at'>[] {
    const {
      sourceDbId,
      sourceSlug,
      sourceVersion,
      licenseStatus,
      rawContent,
      predefinedChunks,
    } = params;

    // 1. Enforce copyright boundary
    if (licenseStatus === 'METADATA_ONLY') {
      if ((rawContent && rawContent.length > 0) || (predefinedChunks && predefinedChunks.length > 0)) {
        throw new AppError(
          'METADATA_ONLY sources strictly prohibit content chunk ingestion to respect copyright boundaries.',
          400,
          'COPYRIGHT_RESTRICTION'
        );
      }
      return [];
    }

    const outputChunks: Omit<KnowledgeChunkRecord, 'id' | 'created_at' | 'updated_at'>[] = [];

    // 2. If predefined chunks are provided, validate and stamp each
    if (predefinedChunks && predefinedChunks.length > 0) {
      predefinedChunks.forEach((item, index) => {
        const normalized = normalizeContent(item.content);
        const injectionCheck = injectionDetector.detectInjection(normalized);

        if (injectionCheck.hasInjection) {
          throw new AppError(
            `Prompt injection detected in chunk "${item.headline}": matches pattern ${injectionCheck.patterns.join(', ')}`,
            400,
            'SECURITY_INJECTION_DETECTED'
          );
        }

        const contentHash = computeSha256(normalized);
        const chunkId = `chk_${sourceSlug}_v${sourceVersion}_${index + 1}`;

        outputChunks.push({
          chunk_id: chunkId,
          source_id: sourceDbId,
          source_slug: sourceSlug,
          source_version: sourceVersion,
          chunk_index: index + 1,
          chunk_type: item.chunk_type,
          headline: item.headline,
          content: normalized,
          content_hash: contentHash,
          citation_page_or_section: item.citation_page_or_section,
          is_summary: item.is_summary || item.chunk_type === 'SUMMARY',
          summary_attribution: item.summary_attribution,
          prompt_injection_flagged: false,
          is_active: true,
        });
      });

      return outputChunks;
    }

    // 3. If rawContent is provided, auto-chunk by structural sections/paragraphs
    if (rawContent && rawContent.trim().length > 0) {
      const normalizedRaw = normalizeContent(rawContent);
      const injectionCheck = injectionDetector.detectInjection(normalizedRaw);

      if (injectionCheck.hasInjection) {
        throw new AppError(
          `Prompt injection detected in raw content: matches pattern ${injectionCheck.patterns.join(', ')}`,
          400,
          'SECURITY_INJECTION_DETECTED'
        );
      }

      // Split on double newlines (paragraphs/sections)
      const rawSections = normalizedRaw.split(/\n\s*\n/).filter((s) => s.trim().length > 0);
      let currentChunkText = '';
      let chunkCount = 1;

      for (let i = 0; i < rawSections.length; i++) {
        const section = rawSections[i].trim();

        if ((currentChunkText + '\n\n' + section).length > 2500 && currentChunkText.length > 0) {
          const content = normalizeContent(currentChunkText);
          const chunkId = `chk_${sourceSlug}_v${sourceVersion}_${chunkCount}`;
          outputChunks.push({
            chunk_id: chunkId,
            source_id: sourceDbId,
            source_slug: sourceSlug,
            source_version: sourceVersion,
            chunk_index: chunkCount,
            chunk_type: 'ORIGINAL_TEXT',
            headline: `Section ${chunkCount}`,
            content,
            content_hash: computeSha256(content),
            is_summary: false,
            prompt_injection_flagged: false,
            is_active: true,
          });
          chunkCount++;
          currentChunkText = section;
        } else {
          currentChunkText = currentChunkText ? `${currentChunkText}\n\n${section}` : section;
        }
      }

      if (currentChunkText.trim().length > 0) {
        const content = normalizeContent(currentChunkText);
        const chunkId = `chk_${sourceSlug}_v${sourceVersion}_${chunkCount}`;
        outputChunks.push({
          chunk_id: chunkId,
          source_id: sourceDbId,
          source_slug: sourceSlug,
          source_version: sourceVersion,
          chunk_index: chunkCount,
          chunk_type: 'ORIGINAL_TEXT',
          headline: `Section ${chunkCount}`,
          content,
          content_hash: computeSha256(content),
          is_summary: false,
          prompt_injection_flagged: false,
          is_active: true,
        });
      }
    }

    return outputChunks;
  }
}

export const knowledgeChunker = new KnowledgeChunker();
