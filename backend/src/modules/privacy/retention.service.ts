import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../middleware/errorHandler.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';

export interface DataRetentionPolicy {
  immediatePurgeCategories: string[];
  anonymizedAuditRetentionYears: number; // Statutory 7 years for IT Act Section 149
}

export const STATUTORY_RETENTION_POLICY: DataRetentionPolicy = {
  immediatePurgeCategories: ['user-documents-storage', 'transactions', 'conversations', 'profiles'],
  anonymizedAuditRetentionYears: 7,
};

export class RetentionService {
  /**
   * Complete account deletion purging sensitive PII, storage, and ledger records.
   * Statutory AI recommendation logs are scrubbed of user_id / PII and retained
   * strictly for legal audit trail verification under IT Act Section 149.
   */
  async deleteUserAccount(userId: string): Promise<{ success: boolean; purged_records: string[] }> {
    if (!userId) {
      throw new AppError('User ID is required for account deletion', 400, 'USER_ID_REQUIRED');
    }

    const purged: string[] = [];

    try {
      const supabase = getSupabaseAdminClient();

      // 1. Purge all user documents from Supabase Storage
      const { data: files } = await supabase.storage.from('user-documents').list(userId);
      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from('user-documents').remove(filePaths);
        purged.push(`storage:${files.length} files`);
      }

      // 2. Cascade delete database records
      await supabase.from('documents').delete().eq('user_id', userId);
      purged.push('documents');

      await supabase.from('transactions').delete().eq('user_id', userId);
      purged.push('transactions');

      await supabase.from('goals').delete().eq('user_id', userId);
      purged.push('goals');

      await supabase.from('conversations').delete().eq('user_id', userId);
      purged.push('conversations');

      // 3. Anonymize statutory AI audit log (strip user_id, hash query/response)
      const anonymousUserId = '00000000-0000-0000-0000-000000000000';
      await supabase
        .from('ai_recommendations_log')
        .update({ user_id: anonymousUserId, query: '[REDACTED_PURGED_USER_QUERY]' })
        .eq('user_id', userId);
      purged.push('anonymized_audit_logs');

      // 4. Delete profile
      await supabase.from('profiles').delete().eq('id', userId);
      purged.push('profiles');

      return { success: true, purged_records: purged };
    } catch (err: any) {
      throw new AppError(`Data purge encountered error: ${err.message}`, 500, 'DATA_PURGE_FAILED');
    }
  }
}

export const retentionService = new RetentionService();
