import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';

const router = Router();

// Protect entire admin router with requireAuth AND requireRole('ADMIN')
router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('ai_recommendations_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    res.status(200).json({
      data: data || [],
      authorized_admin: req.user?.email || req.user?.id,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export const adminRoutes = router;
