import { Router } from 'express';
import { behavioralController } from './behavioral.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// All behavioral insights endpoints require authentication
router.use(requireAuth);

router.get('/insights', behavioralController.getInsights);

export default router;
