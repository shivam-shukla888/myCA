import { v4 as uuidv4 } from 'uuid';
import { CreateDocumentInput, QueryDocumentInput } from './document.schema.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { env } from '../../config/env.js';

export interface DocumentRecord extends CreateDocumentInput {
  id: string;
  user_id: string;
  storage_path: string;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  extraction_confidence?: number | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
  download_url?: string;
  upload_url?: string;
}

// In-memory store strictly for development/testing when running in offline/mock context
const inMemoryDocuments = new Map<string, DocumentRecord>();

export class DocumentService {
  async createDocumentMetadata(userId: string, input: CreateDocumentInput): Promise<DocumentRecord> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const isProduction = env.NODE_ENV === 'production';
    const documentId = uuidv4();

    // Strict path traversal and filename validation
    if (input.file_name.includes('..') || input.file_name.includes('/') || input.file_name.includes('\\')) {
      throw new AppError('Path traversal sequence detected in file name', 400, 'SECURITY_PATH_TRAVERSAL_DETECTED');
    }

    const baseName = input.file_name.split(/[/\\]/).pop() || 'document';
    const sanitizedFileName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/${documentId}/${sanitizedFileName}`;

    const now = new Date().toISOString();
    const record: DocumentRecord = {
      ...input,
      id: documentId,
      user_id: userId,
      storage_path: storagePath,
      extraction_status: 'pending',
      extraction_confidence: null,
      uploaded_at: now,
      created_at: now,
      updated_at: now,
    };

    try {
      const supabase = getSupabaseAdminClient();
      
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

      const { data, error } = await supabase
        .from('documents')
        .insert({
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
        })
        .select()
        .single();

      if (error) {
        if (isProduction) {
          throw new AppError(`Document metadata persistence failed: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data) {
        const saved = {
          ...data,
          upload_url: record.upload_url,
        } as DocumentRecord;
        if (!isProduction) {
          inMemoryDocuments.set(record.id, saved);
        }
        return saved;
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
        return { documents: data as DocumentRecord[], total: count !== null && count !== undefined ? count : data.length };
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
    let filtered = userDocs;
    if (query.document_type) filtered = filtered.filter((d) => d.document_type === query.document_type);
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

        const { data: signedDownload } = await supabase.storage
          .from('user-documents')
          .createSignedUrl(anyDoc.storage_path, 900);

        return {
          ...anyDoc,
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
      ...record,
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
}

export const documentService = new DocumentService();
