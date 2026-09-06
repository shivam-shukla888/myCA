import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import {
  KnowledgeSourceRecord,
  KnowledgeChunkRecord,
  QueryKnowledgeSourceInput,
  SourceStatus,
} from './knowledge.schema.js';

// In-memory stores for testing or environments without live Supabase
export const inMemoryKnowledgeSources = new Map<string, KnowledgeSourceRecord>();
export const inMemoryKnowledgeChunks = new Map<string, KnowledgeChunkRecord>();

export class KnowledgeRepository {
  private isProduction(): boolean {
    return env.NODE_ENV === 'production';
  }

  async findSourceBySlug(sourceId: string): Promise<KnowledgeSourceRecord | null> {
    const isProd = this.isProduction();

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('knowledge_sources')
        .select('*')
        .eq('source_id', sourceId)
        .maybeSingle();

      if (!error && data) {
        return data as KnowledgeSourceRecord;
      }
    } catch {
      if (isProd) throw new Error('Database connection failed during knowledge lookup');
    }

    // In-memory lookup
    for (const src of inMemoryKnowledgeSources.values()) {
      if (src.source_id === sourceId) return src;
    }
    return null;
  }

  async findSourceById(id: string): Promise<KnowledgeSourceRecord | null> {
    const isProd = this.isProduction();

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('knowledge_sources')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return data as KnowledgeSourceRecord;
      }
    } catch {
      if (isProd) throw new Error('Database connection failed during knowledge lookup');
    }

    return inMemoryKnowledgeSources.get(id) || null;
  }

  async insertSource(
    source: Omit<KnowledgeSourceRecord, 'id' | 'created_at' | 'updated_at'>,
    chunks: Omit<KnowledgeChunkRecord, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<KnowledgeSourceRecord> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const isProd = this.isProduction();

    const record: KnowledgeSourceRecord = {
      ...source,
      status: source.status || 'ACTIVE',
      id,
      created_at: now,
      updated_at: now,
    };

    const chunkRecords: KnowledgeChunkRecord[] = chunks.map((c) => ({
      ...c,
      id: uuidv4(),
      source_id: id,
      created_at: now,
      updated_at: now,
    }));

    try {
      const supabase = getSupabaseAdminClient();

      const { data: insertedSource, error: srcError } = await supabase
        .from('knowledge_sources')
        .insert({
          id: record.id,
          source_id: record.source_id,
          version: record.version,
          title: record.title,
          author_or_organization: record.author_or_organization,
          source_type: record.source_type,
          topic: record.topic,
          country: record.country,
          publication_date: record.publication_date || null,
          last_verified_at: record.last_verified_at,
          authority_level: record.authority_level,
          license_status: record.license_status,
          canonical_url: record.canonical_url || null,
          description: record.description,
          status: record.status,
          content_hash: record.content_hash || null,
        })
        .select()
        .single();

      if (srcError) {
        if (isProd) throw new Error(`Failed to persist knowledge source: ${srcError.message}`);
      } else {
        if (chunkRecords.length > 0) {
          const { error: chkError } = await supabase.from('knowledge_chunks').insert(
            chunkRecords.map((c) => ({
              id: c.id,
              chunk_id: c.chunk_id,
              source_id: c.source_id,
              source_slug: c.source_slug,
              source_version: c.source_version,
              chunk_index: c.chunk_index,
              chunk_type: c.chunk_type,
              headline: c.headline,
              content: c.content,
              content_hash: c.content_hash,
              citation_page_or_section: c.citation_page_or_section || null,
              is_summary: c.is_summary,
              summary_attribution: c.summary_attribution || null,
              prompt_injection_flagged: c.prompt_injection_flagged,
              is_active: c.is_active,
            }))
          );
          if (chkError && isProd) {
            throw new Error(`Failed to persist knowledge chunks: ${chkError.message}`);
          }
        }
      }
    } catch (err: any) {
      if (isProd) throw err;
    }

    // Always mirror to in-memory for testing / offline
    inMemoryKnowledgeSources.set(id, { ...record, chunks: chunkRecords });
    for (const chunk of chunkRecords) {
      inMemoryKnowledgeChunks.set(chunk.chunk_id, chunk);
    }

    return { ...record, chunks: chunkRecords };
  }

  async updateSource(
    id: string,
    updates: Partial<KnowledgeSourceRecord>,
    newChunks?: Omit<KnowledgeChunkRecord, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<KnowledgeSourceRecord> {
    const existing = await this.findSourceById(id);
    if (!existing) {
      throw new Error(`Knowledge source not found for id=${id}`);
    }

    const now = new Date().toISOString();
    const updatedRecord: KnowledgeSourceRecord = {
      ...existing,
      ...updates,
      updated_at: now,
    };

    const isProd = this.isProduction();

    try {
      const supabase = getSupabaseAdminClient();
      await supabase
        .from('knowledge_sources')
        .update({
          version: updatedRecord.version,
          title: updatedRecord.title,
          author_or_organization: updatedRecord.author_or_organization,
          source_type: updatedRecord.source_type,
          topic: updatedRecord.topic,
          country: updatedRecord.country,
          publication_date: updatedRecord.publication_date || null,
          last_verified_at: updatedRecord.last_verified_at,
          authority_level: updatedRecord.authority_level,
          license_status: updatedRecord.license_status,
          canonical_url: updatedRecord.canonical_url || null,
          description: updatedRecord.description,
          status: updatedRecord.status,
          content_hash: updatedRecord.content_hash || null,
          updated_at: now,
        })
        .eq('id', id);

      if (newChunks && newChunks.length > 0) {
        const chunkRecords: KnowledgeChunkRecord[] = newChunks.map((c) => ({
          ...c,
          id: uuidv4(),
          source_id: id,
          created_at: now,
          updated_at: now,
        }));

        await supabase.from('knowledge_chunks').insert(
          chunkRecords.map((c) => ({
            id: c.id,
            chunk_id: c.chunk_id,
            source_id: c.source_id,
            source_slug: c.source_slug,
            source_version: c.source_version,
            chunk_index: c.chunk_index,
            chunk_type: c.chunk_type,
            headline: c.headline,
            content: c.content,
            content_hash: c.content_hash,
            citation_page_or_section: c.citation_page_or_section || null,
            is_summary: c.is_summary,
            summary_attribution: c.summary_attribution || null,
            prompt_injection_flagged: c.prompt_injection_flagged,
            is_active: c.is_active,
          }))
        );

        updatedRecord.chunks = [...(existing.chunks || []), ...chunkRecords];
        for (const chunk of chunkRecords) {
          inMemoryKnowledgeChunks.set(chunk.chunk_id, chunk);
        }
      }
    } catch (err: any) {
      if (isProd) throw err;
    }

    inMemoryKnowledgeSources.set(id, updatedRecord);
    return updatedRecord;
  }

  async updateSourceStatus(id: string, status: SourceStatus): Promise<KnowledgeSourceRecord> {
    const existing = await this.findSourceById(id);
    if (!existing) {
      throw new Error(`Knowledge source not found for id=${id}`);
    }

    const now = new Date().toISOString();
    const updated: KnowledgeSourceRecord = {
      ...existing,
      status,
      updated_at: now,
    };

    const isProd = this.isProduction();
    const deactivateChunks = status === 'RETRACTED' || status === 'OUTDATED' || status === 'ARCHIVED';

    try {
      const supabase = getSupabaseAdminClient();
      await supabase
        .from('knowledge_sources')
        .update({ status, updated_at: now })
        .eq('id', id);

      if (deactivateChunks) {
        await supabase
          .from('knowledge_chunks')
          .update({ is_active: false, updated_at: now })
          .eq('source_id', id);
      }
    } catch (err: any) {
      if (isProd) throw err;
    }

    if (deactivateChunks && updated.chunks) {
      updated.chunks = updated.chunks.map((c) => ({ ...c, is_active: false, updated_at: now }));
      for (const c of updated.chunks) {
        inMemoryKnowledgeChunks.set(c.chunk_id, c);
      }
    }

    inMemoryKnowledgeSources.set(id, updated);
    return updated;
  }

  async listSources(query: QueryKnowledgeSourceInput): Promise<{ sources: KnowledgeSourceRecord[]; total: number }> {
    const isProd = this.isProduction();

    try {
      const supabase = getSupabaseAdminClient();
      let req = supabase.from('knowledge_sources').select('*', { count: 'exact' });

      const effectiveStatus = query.status || 'ACTIVE';
      req = req.eq('status', effectiveStatus);
      if (query.topic) req = req.ilike('topic', `%${query.topic}%`);
      if (query.source_type) req = req.eq('source_type', query.source_type);
      if (query.authority_level) req = req.eq('authority_level', query.authority_level);
      if (query.country) req = req.eq('country', query.country);
      if (query.search) {
        req = req.or(`title.ilike.%${query.search}%,description.ilike.%${query.search}%,author_or_organization.ilike.%${query.search}%`);
      }

      req = req.order('authority_level', { ascending: true })
               .order('created_at', { ascending: false })
               .range(query.offset, query.offset + query.limit - 1);

      const { data, count, error } = await req;
      if (!error && data) {
        return { sources: data as KnowledgeSourceRecord[], total: count || data.length };
      }
    } catch {
      if (isProd) throw new Error('Database connection failed during knowledge list');
    }

    // In-memory fallback
    const effectiveStatus = query.status || 'ACTIVE';
    let items = Array.from(inMemoryKnowledgeSources.values()).filter((s) => s.status === effectiveStatus);
    if (query.topic) items = items.filter((s) => s.topic.toLowerCase().includes(query.topic!.toLowerCase()));
    if (query.source_type) items = items.filter((s) => s.source_type === query.source_type);
    if (query.authority_level) items = items.filter((s) => s.authority_level === query.authority_level);
    if (query.country) items = items.filter((s) => s.country === query.country);
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.author_or_organization.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => a.authority_level - b.authority_level);
    const total = items.length;
    const paginated = items.slice(query.offset, query.offset + query.limit);

    return { sources: paginated, total };
  }

  async findChunkById(chunkId: string): Promise<KnowledgeChunkRecord | null> {
    const isProd = this.isProduction();

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('knowledge_chunks')
        .select('*')
        .eq('chunk_id', chunkId)
        .maybeSingle();

      if (!error && data) {
        return data as KnowledgeChunkRecord;
      }
    } catch {
      if (isProd) throw new Error('Database connection failed during chunk lookup');
    }

    return inMemoryKnowledgeChunks.get(chunkId) || null;
  }

  async getChunksForSource(sourceId: string, version?: number): Promise<KnowledgeChunkRecord[]> {
    const isProd = this.isProduction();

    try {
      const supabase = getSupabaseAdminClient();
      let req = supabase
        .from('knowledge_chunks')
        .select('*')
        .eq('source_id', sourceId);

      if (version !== undefined) {
        req = req.eq('source_version', version);
      }

      req = req.order('chunk_index', { ascending: true });

      const { data, error } = await req;
      if (!error && data) {
        return data as KnowledgeChunkRecord[];
      }
    } catch {
      if (isProd) throw new Error('Database connection failed during chunk retrieval');
    }

    let chunks = Array.from(inMemoryKnowledgeChunks.values()).filter((c) => c.source_id === sourceId);
    if (version !== undefined) {
      chunks = chunks.filter((c) => c.source_version === version);
    }
    chunks.sort((a, b) => a.chunk_index - b.chunk_index);
    return chunks;
  }
}

export const knowledgeRepository = new KnowledgeRepository();
