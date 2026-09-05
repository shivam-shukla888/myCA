import { Router } from 'express';
import { actionController } from './action.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// All action routes require authentication
router.use(requireAuth);

router.get('/plan', (req, res, next) => actionController.getPlan(req, res).catch(next));
router.post('/plan', (req, res, next) => actionController.generatePlan(req, res).catch(next));
router.post('/confirm', (req, res, next) => actionController.confirmPlan(req, res).catch(next));
router.post('/simulate', (req, res, next) => actionController.simulatePlan(req, res).catch(next));
router.get('/history', (req, res, next) => actionController.getHistory(req, res).catch(next));

export default router;
