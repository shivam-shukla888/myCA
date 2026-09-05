import { Router } from 'express';
import { ocrController } from './ocr.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// All OCR routes strictly require authentication
router.use(requireAuth);

router.post('/extract/:documentId', (req, res, next) => ocrController.extract(req, res, next));
router.get('/draft/:documentId', (req, res, next) => ocrController.getDraft(req, res, next));
router.post('/confirm', (req, res, next) => ocrController.confirm(req, res, next));

export default router;
