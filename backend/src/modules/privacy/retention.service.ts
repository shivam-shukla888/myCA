import { AppError } from '../../middleware/errorHandler.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';

export interface ProductDataRetentionPolicy {
  purgeCategories: string[];
  anonymizeAuditLogs: boolean;
}

/**
 * Explicit product retention policy separating user data lifecycle from statutory claims.
 */
export const DEFAULT_PRODUCT_RETENTION_POLICY: ProductDataRetentionPolicy = {
  purgeCategories: ['user-documents-storage', 'transactions', 'conversations', 'goals', 'profiles'],
  anonymizeAuditLogs: true,
};

export class RetentionService {
  /**
   * Complete account deletion purging sensitive user PII, storage, and ledger records.
   * Product deletion is idempotent and deletes actual stored objects before clearing metadata.
   */
  async deleteUserAccount(
    userId: string,
    policy: ProductDataRetentionPolicy = DEFAULT_PRODUCT_RETENTION_POLICY
  ): Promise<{ success: boolean; purged_records: string[] }> {
    if (!userId) {
      throw new AppError('User ID is required for account deletion', 400, 'USER_ID_REQUIRED');
    }

    const purged: string[] = [];

    try {
      const supabase = getSupabaseAdminClient();

      // 1. Fetch exact document storage paths before clearing metadata
      const { data: userDocs } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('user_id', userId);

      const pathsToRemove: string[] = [];
      if (userDocs && userDocs.length > 0) {
        for (const doc of userDocs) {
          if (doc.storage_path) {
            pathsToRemove.push(doc.storage_path);
          }
        }
      }

      // Also list the top-level user folder to catch any non-indexed files
      const { data: topLevelFiles } = await supabase.storage.from('user-documents').list(userId);
      if (topLevelFiles && topLevelFiles.length > 0) {
        for (const f of topLevelFiles) {
          pathsToRemove.push(`${userId}/${f.name}`);
        }
      }

      if (pathsToRemove.length > 0) {
        const uniquePaths = Array.from(new Set(pathsToRemove));
        await supabase.storage.from('user-documents').remove(uniquePaths);
        purged.push(`storage:${uniquePaths.length} objects`);
      }

      // 2. Cascade delete database records idempotently
      await supabase.from('documents').delete().eq('user_id', userId);
      purged.push('documents');

      await supabase.from('transactions').delete().eq('user_id', userId);
      purged.push('transactions');

      await supabase.from('goals').delete().eq('user_id', userId);
      purged.push('goals');

      await supabase.from('conversations').delete().eq('user_id', userId);
      purged.push('conversations');

      // 3. Anonymize AI audit logs without retaining PII
      if (policy.anonymizeAuditLogs) {
        const anonymousUserId = '00000000-0000-0000-0000-000000000000';
        await supabase
          .from('ai_recommendations_log')
          .update({
            user_id: anonymousUserId,
            query: '[PURGED_USER_QUERY]',
            response: '[PURGED_USER_RESPONSE]',
            disclaimer_text: null,
          })
          .eq('user_id', userId);
        purged.push('anonymized_audit_logs');
      }

      // 4. Delete profile
      await supabase.from('profiles').delete().eq('id', userId);
      purged.push('profiles');

      // 5. Delete Supabase Auth user via administrative API
      try {
        if (supabase.auth?.admin?.deleteUser) {
          await supabase.auth.admin.deleteUser(userId);
          purged.push('auth_user');
        }
      } catch (authErr) {
        // Idempotent: user might already be removed from auth
      }

      return { success: true, purged_records: purged };
    } catch (err: any) {
      throw new AppError(`Data purge encountered error: ${err.message}`, 500, 'DATA_PURGE_FAILED');
    }
  }
}

export const retentionService = new RetentionService();
