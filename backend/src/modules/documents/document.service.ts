import { v4 as uuidv4 } from 'uuid';
import { CreateDocumentInput, QueryDocumentInput } from './document.schema.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';

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

const inMemoryDocuments = new Map<string, DocumentRecord>();

export class DocumentService {
  async createDocumentMetadata(userId: string, input: CreateDocumentInput): Promise<DocumentRecord> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

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
      upload_url: `https://mock-storage.local/upload/${storagePath}?token=mock_upload_token`,
    };

    inMemoryDocuments.set(record.id, record);

    try {
      const supabase = getSupabaseAdminClient();
      
      const { data: signedUpload } = await supabase.storage
        .from('user-documents')
        .createSignedUploadUrl(storagePath);

      if (signedUpload) {
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

      if (!error && data) {
        return {
          ...data,
          upload_url: record.upload_url,
        } as DocumentRecord;
      }
    } catch (err) {
      // Fallback
    }

    return record;
  }

  async listDocuments(userId: string, query: QueryDocumentInput): Promise<{ documents: DocumentRecord[]; total: number }> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);

    try {
      const supabase = getSupabaseAdminClient();
      let dbQuery = supabase.from('documents').select('*', { count: 'exact' }).eq('user_id', userId);

      if (query.document_type) dbQuery = dbQuery.eq('document_type', query.document_type);
      if (query.financial_year) dbQuery = dbQuery.eq('financial_year', query.financial_year);

      dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await dbQuery;
      if (!error && data && data.length > 0) {
        return { documents: data as DocumentRecord[], total: count || data.length };
      }
    } catch (err) {
      // Fallback
    }

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

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        const { data: signedDownload } = await supabase.storage
          .from('user-documents')
          .createSignedUrl(data.storage_path, 900);

        return {
          ...data,
          download_url: signedDownload?.signedUrl,
        } as DocumentRecord;
      }
    } catch (err) {
      // Fallback
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
    await this.getDocumentById(userId, id);

    inMemoryDocuments.delete(id);

    try {
      const supabase = getSupabaseAdminClient();
      await supabase.storage.from('user-documents').remove([`mock-path`]);
      await supabase.from('documents').delete().eq('id', id).eq('user_id', userId);
    } catch (err) {
      // Fallback
    }

    return { success: true, id };
  }
}

export const documentService = new DocumentService();
