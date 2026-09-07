import { v4 as uuidv4 } from 'uuid';
import { CreateDocumentInput, QueryDocumentInput } from './document.schema.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { env } from '../../config/env.js';

export interface DocumentRecord extends CreateDocumentInput {
  id: string;
  user_id: string;
  storage_path: string;
  source_type: 'DOCUMENT' | 'IMAGE' | 'VIDEO';
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  ocr_status: 'not_applicable' | 'pending' | 'processing' | 'completed' | 'failed';
  verification_status: 'unverified' | 'draft_ready' | 'user_confirmed' | 'rejected';
  confirmed_at?: string | null;
  title?: string | null;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  extraction_confidence?: number | null;
  extracted_data?: any;
  file_hash?: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
  download_url?: string;
  upload_url?: string;
}

// In-memory store strictly for development/testing when running in offline/mock context
const inMemoryDocuments = new Map<string, DocumentRecord>();

function normalizeDocumentRecord(row: any): DocumentRecord {
  let sourceType: 'DOCUMENT' | 'IMAGE' | 'VIDEO' =
    row.source_type ||
    row.extracted_data?.source_type ||
    (row.mime_type?.startsWith('video/') ? 'VIDEO' : row.mime_type?.startsWith('image/') ? 'IMAGE' : 'DOCUMENT');

  let ocrStatus: 'not_applicable' | 'pending' | 'processing' | 'completed' | 'failed' =
    row.ocr_status ||
    row.extracted_data?.ocr_status ||
    (sourceType === 'VIDEO' ? 'not_applicable' : row.extraction_status === 'completed' ? 'completed' : 'pending');

  let verificationStatus: 'unverified' | 'draft_ready' | 'user_confirmed' | 'rejected' =
    row.verification_status ||
    row.extracted_data?.verification_status ||
    (row.extracted_data?.confirmed_at ? 'user_confirmed' : row.extracted_data?.extraction_status === 'draft_ready' || row.extraction_status === 'completed' ? 'draft_ready' : 'unverified');

  return {
    ...row,
    source_type: sourceType,
    processing_status: row.processing_status || row.extracted_data?.processing_status || 'completed',
    ocr_status: ocrStatus,
    verification_status: verificationStatus,
    confirmed_at: row.confirmed_at || row.extracted_data?.confirmed_at || null,
    title: row.title || row.extracted_data?.title || null,
    file_hash: row.file_hash || row.extracted_data?.file_hash || null,
  };
}

export class DocumentService {
  async createDocumentMetadata(userId: string, input: CreateDocumentInput): Promise<DocumentRecord> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const isProduction = process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production';
    const documentId = uuidv4();

    // Strict path traversal and filename validation
    if (input.file_name.includes('..') || input.file_name.includes('/') || input.file_name.includes('\\')) {
      throw new AppError('Path traversal sequence detected in file name', 400, 'SECURITY_PATH_TRAVERSAL_DETECTED');
    }

    const baseName = input.file_name.split(/[/\\]/).pop() || 'document';
    const sanitizedFileName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/${documentId}/${sanitizedFileName}`;

    // Determine canonical source type
    let sourceType: 'DOCUMENT' | 'IMAGE' | 'VIDEO' = input.source_type || 'DOCUMENT';
    if (!input.source_type) {
      if (input.mime_type.startsWith('video/')) {
        sourceType = 'VIDEO';
      } else if (input.mime_type.startsWith('image/')) {
        sourceType = 'IMAGE';
      } else {
        sourceType = 'DOCUMENT';
      }
    }

    const ocrStatus = sourceType === 'VIDEO' ? 'not_applicable' : 'pending';
    const verificationStatus = 'unverified';
    const processingStatus = 'completed';

    // 1. In-memory duplicate SHA-256 evidence check (for authenticated user)
    if (input.file_hash) {
      for (const existingDoc of inMemoryDocuments.values()) {
        if (existingDoc.user_id === userId && existingDoc.file_hash === input.file_hash) {
          throw new AppError('Duplicate evidence document detected with identical SHA-256 checksum', 409, 'DUPLICATE_EVIDENCE_DETECTED');
        }
      }
    }

    const now = new Date().toISOString();
    const record: DocumentRecord = {
      ...input,
      id: documentId,
      user_id: userId,
      source_type: sourceType,
      processing_status: processingStatus,
      ocr_status: ocrStatus,
      verification_status: verificationStatus,
      confirmed_at: null,
      title: input.title || null,
      file_hash: input.file_hash || null,
      storage_path: storagePath,
      extraction_status: 'pending',
      extraction_confidence: null,
      uploaded_at: now,
      created_at: now,
      updated_at: now,
    };

    try {
      const supabase = getSupabaseAdminClient();

      // Check database for duplicate SHA-256 hash for this user (resilient across schema versions)
      if (input.file_hash) {
        const existingDbDoc = await this.findDuplicateByHash(userId, input.file_hash);
        if (existingDbDoc) {
          throw new AppError('Duplicate evidence document detected with identical SHA-256 checksum', 409, 'DUPLICATE_EVIDENCE_DETECTED');
        }
      }
      
      const { data: signedUpload, error: uploadErr } = await supabase.storage
        .from('user-documents')
        .createSignedUploadUrl(storagePath);

      if (uploadErr) {
        if (isProduction) {
          throw new AppError(`Failed to create signed upload URL: ${uploadErr.message}`, 500, 'STORAGE_UPLOAD_URL_FAILED');
        }
      } else if (signedUpload) {
        record.upload_url = signedUpload.signedUrl;
      }

      // Preserve metadata in extracted_data for forward/backward compatibility
      const metaEnvelope = {
        source_type: sourceType,
        processing_status: processingStatus,
        ocr_status: ocrStatus,
        verification_status: verificationStatus,
        title: input.title || null,
        file_hash: input.file_hash || null,
      };

      // Try inserting with all fields
      let dbInsertPayload: any = {
        id: record.id,
        user_id: record.user_id,
        file_name: record.file_name,
        file_type: record.file_type,
        file_size_bytes: record.file_size_bytes,
        storage_path: record.storage_path,
        mime_type: record.mime_type,
        document_type: record.document_type,
        extraction_status: record.extraction_status,
        financial_year: record.financial_year || null,
        file_hash: record.file_hash || null,
        extracted_data: metaEnvelope,
      };

      const { data, error } = await supabase
        .from('documents')
        .insert(dbInsertPayload)
        .select()
        .single();

      if (error) {
        if (isProduction) {
          throw new AppError(`Document metadata persistence failed: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data) {
        const normalized = normalizeDocumentRecord({
          ...data,
          upload_url: record.upload_url,
          title: record.title,
          source_type: record.source_type,
          ocr_status: record.ocr_status,
          verification_status: record.verification_status,
        });

        if (!isProduction) {
          inMemoryDocuments.set(record.id, normalized);
        }
        return normalized;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Document creation failed in production database/storage', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Document creation failed in production environment', 500, 'DATABASE_PERSISTENCE_FAILED');
    }

    // Development/test mock fallback only
    record.upload_url = record.upload_url || `https://mock-storage.local/upload/${storagePath}?token=mock_upload_token`;
    inMemoryDocuments.set(record.id, record);
    return record;
  }

  async listDocuments(userId: string, query: QueryDocumentInput): Promise<{ documents: DocumentRecord[]; total: number }> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const isProduction = env.NODE_ENV === 'production';
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);

    try {
      const supabase = getSupabaseAdminClient();
      let dbQuery = supabase.from('documents').select('*', { count: 'exact' }).eq('user_id', userId);

      if (query.document_type) dbQuery = dbQuery.eq('document_type', query.document_type);
      if (query.financial_year) dbQuery = dbQuery.eq('financial_year', query.financial_year);

      dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await dbQuery;
      if (error) {
        if (isProduction) {
          throw new AppError(`Failed to list documents: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data) {
        let normalizedList = data.map(normalizeDocumentRecord);

        // Apply client filters if specified
        if (query.source_type) {
          normalizedList = normalizedList.filter((d) => d.source_type === query.source_type);
        }
        if (query.verification_status) {
          normalizedList = normalizedList.filter((d) => d.verification_status === query.verification_status);
        }

        if (!isProduction) {
          const userInMem = Array.from(inMemoryDocuments.values()).filter((d) => d.user_id === userId);
          if (data.length === 0 && userInMem.length > 0) {
            let filtered = userInMem.map(normalizeDocumentRecord);
            if (query.document_type) filtered = filtered.filter((d) => d.document_type === query.document_type);
            if (query.source_type) filtered = filtered.filter((d) => d.source_type === query.source_type);
            if (query.verification_status) filtered = filtered.filter((d) => d.verification_status === query.verification_status);
            if (query.financial_year) filtered = filtered.filter((d) => d.financial_year === query.financial_year);
            filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return { documents: filtered.slice(offset, offset + limit), total: filtered.length };
          }
          // Merge in-memory updates
          const mergedData = normalizedList.map((d: any) => {
            const inMem = inMemoryDocuments.get(d.id);
            return inMem ? normalizeDocumentRecord({ ...d, ...inMem }) : d;
          });
          return { documents: mergedData, total: count !== null && count !== undefined ? count : mergedData.length };
        }
        return { documents: normalizedList, total: count !== null && count !== undefined ? count : normalizedList.length };
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Document query failed in production database', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Document query failed in production database', 500, 'DATABASE_QUERY_FAILED');
    }

    // Filter in-memory by user_id (development/test mode only)
    const userDocs = Array.from(inMemoryDocuments.values()).filter((d) => d.user_id === userId);
    let filtered = userDocs.map(normalizeDocumentRecord);
    if (query.document_type) filtered = filtered.filter((d) => d.document_type === query.document_type);
    if (query.source_type) filtered = filtered.filter((d) => d.source_type === query.source_type);
    if (query.verification_status) filtered = filtered.filter((d) => d.verification_status === query.verification_status);
    if (query.financial_year) filtered = filtered.filter((d) => d.financial_year === query.financial_year);

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const paginated = filtered.slice(offset, offset + limit);

    return { documents: paginated, total: filtered.length };
  }

  async getDocumentById(userId: string, id: string): Promise<DocumentRecord> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const isProduction = env.NODE_ENV === 'production';

    try {
      const supabase = getSupabaseAdminClient();
      
      // First check if document exists under ANY user to enforce strict IDOR 403 vs 404
      const { data: anyDoc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (anyDoc) {
        if (anyDoc.user_id !== userId) {
          throw new AppError('Access denied: You do not have permission to view this document', 403, 'FORBIDDEN');
        }

        const inMem = !isProduction ? inMemoryDocuments.get(id) : null;
        const merged = normalizeDocumentRecord({
          ...anyDoc,
          ...(inMem || {}),
        });

        const { data: signedDownload } = await supabase.storage
          .from('user-documents')
          .createSignedUrl(anyDoc.storage_path, 900);

        return {
          ...merged,
          download_url: signedDownload?.signedUrl,
        } as DocumentRecord;
      } else if (isProduction) {
        throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Document fetch failed in production database', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    const record = inMemoryDocuments.get(id);
    if (!record) {
      throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (record.user_id !== userId) {
      throw new AppError('Access denied: You do not have permission to view this document', 403, 'FORBIDDEN');
    }

    return {
      ...normalizeDocumentRecord(record),
      download_url: `https://mock-storage.local/download/${record.storage_path}?expires=900`,
    };
  }

  async deleteDocument(userId: string, id: string): Promise<{ success: boolean; id: string }> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const isProduction = env.NODE_ENV === 'production';
    const existing = await this.getDocumentById(userId, id);

    // Strict ownership verification
    if (existing.user_id !== userId) {
      throw new AppError('Access denied: You do not have permission to delete this document', 403, 'FORBIDDEN');
    }

    // Prevent storage path manipulation (must start with userId/)
    if (!existing.storage_path.startsWith(`${userId}/`)) {
      throw new AppError('Security violation: Storage path does not match user namespace', 403, 'FORBIDDEN');
    }

    try {
      const supabase = getSupabaseAdminClient();
      
      // Delete the actual storage path
      const { error: storageErr } = await supabase.storage
        .from('user-documents')
        .remove([existing.storage_path]);

      if (storageErr && isProduction) {
        throw new AppError(`Failed to delete document from storage: ${storageErr.message}`, 500, 'STORAGE_DELETION_FAILED');
      }

      // Delete database metadata
      const { error: dbErr } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (dbErr && isProduction) {
        throw new AppError(`Failed to delete document record: ${dbErr.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
      }

      if (!isProduction) {
        inMemoryDocuments.delete(id);
      }

      return { success: true, id };
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Document deletion failed in production environment', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Document deletion failed in production environment', 500, 'DATABASE_PERSISTENCE_FAILED');
    }

    inMemoryDocuments.delete(id);
    return { success: true, id };
  }

  async updateDocumentExtraction(
    userId: string,
    id: string,
    updates: {
      extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
      extraction_confidence?: number | null;
      extracted_data: any;
      file_hash?: string | null;
      ocr_status?: 'not_applicable' | 'pending' | 'processing' | 'completed' | 'failed';
      verification_status?: 'unverified' | 'draft_ready' | 'user_confirmed' | 'rejected';
      confirmed_at?: string | null;
    }
  ): Promise<DocumentRecord> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const isProduction = env.NODE_ENV === 'production';
    const existing = await this.getDocumentById(userId, id);

    if (existing.user_id !== userId) {
      throw new AppError('Access denied: You do not have permission to update this document', 403, 'FORBIDDEN');
    }

    const now = new Date().toISOString();
    const ocrStatus = updates.ocr_status || (updates.extraction_status === 'completed' ? 'completed' : existing.ocr_status);
    const verificationStatus = updates.verification_status || (updates.confirmed_at ? 'user_confirmed' : existing.verification_status);

    const mergedExtractedData = {
      ...(existing.extracted_data || {}),
      ...(updates.extracted_data || {}),
      ocr_status: ocrStatus,
      verification_status: verificationStatus,
      confirmed_at: updates.confirmed_at !== undefined ? updates.confirmed_at : existing.confirmed_at,
      file_hash: updates.file_hash !== undefined ? updates.file_hash : existing.file_hash,
    };

    const updatedRecord: DocumentRecord = {
      ...existing,
      extraction_status: updates.extraction_status,
      extraction_confidence: updates.extraction_confidence !== undefined ? updates.extraction_confidence : existing.extraction_confidence,
      extracted_data: mergedExtractedData,
      ocr_status: ocrStatus,
      verification_status: verificationStatus,
      confirmed_at: updates.confirmed_at !== undefined ? updates.confirmed_at : existing.confirmed_at,
      file_hash: updates.file_hash !== undefined ? updates.file_hash : existing.file_hash,
      updated_at: now,
    };

    try {
      const supabase = getSupabaseAdminClient();
      const basePayload: any = {
        extraction_status: updates.extraction_status,
        extraction_confidence: updates.extraction_confidence !== undefined ? updates.extraction_confidence : null,
        extracted_data: mergedExtractedData,
        updated_at: now,
      };

      let data: any = null;
      let error: any = null;

      if (updates.file_hash) {
        const attempt = await supabase
          .from('documents')
          .update({ ...basePayload, file_hash: updates.file_hash })
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        data = attempt.data;
        error = attempt.error;
      }

      if (error || !updates.file_hash) {
        const fallbackAttempt = await supabase
          .from('documents')
          .update(basePayload)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        data = fallbackAttempt.data;
        error = fallbackAttempt.error;
      }

      if (error && isProduction) {
        throw new AppError(`Document extraction update failed: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
      }

      if (data) {
        const saved = normalizeDocumentRecord({ ...existing, ...data, file_hash: updates.file_hash || data.file_hash });
        if (!isProduction) {
          inMemoryDocuments.set(id, saved);
        }
        return saved;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Document extraction update failed in production database', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    if (isProduction) {
      throw new AppError('Document extraction update failed in production environment', 500, 'DATABASE_PERSISTENCE_FAILED');
    }

    inMemoryDocuments.set(id, updatedRecord);
    return updatedRecord;
  }

  async findDuplicateByHash(userId: string, fileHash: string, excludeDocId?: string): Promise<DocumentRecord | null> {
    const isProduction = process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production';
    try {
      const supabase = getSupabaseAdminClient();
      let query = supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .eq('file_hash', fileHash);

      if (excludeDocId) {
        query = query.neq('id', excludeDocId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) {
        if (isProduction) {
          throw new AppError(`Database query failed during document deduplication check: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data) {
        return normalizeDocumentRecord(data);
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Database query failed during document deduplication check', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    if (isProduction) {
      return null;
    }

    // In-memory fallback for test and non-production environments only
    const userDocs = Array.from(inMemoryDocuments.values()).filter((d) => d.user_id === userId);
    const inMemFound = userDocs.find((d) => {
      if (excludeDocId && d.id === excludeDocId) return false;
      const hash = d.file_hash || d.extracted_data?.file_hash;
      return hash === fileHash;
    });

    return inMemFound ? normalizeDocumentRecord(inMemFound) : null;
  }
}

export const documentService = new DocumentService();
