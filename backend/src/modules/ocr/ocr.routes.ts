import { Router } from 'express';
import { ocrController } from './ocr.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// All OCR routes strictly require authentication
router.use(requireAuth);

// Extraction endpoints
router.post('/extract/:documentId', (req, res, next) => ocrController.extract(req, res, next));
router.post('/:documentId/extract', (req, res, next) => ocrController.extract(req, res, next));

// Draft retrieval endpoints
router.get('/draft/:documentId', (req, res, next) => ocrController.getDraft(req, res, next));
router.get('/:documentId', (req, res, next) => ocrController.getDraft(req, res, next));

// Confirmation endpoints (User Confirmation Gate)
router.post('/confirm', (req, res, next) => ocrController.confirm(req, res, next));
router.post('/:documentId/confirm', (req, res, next) => ocrController.confirm(req, res, next));

// Rejection endpoints
router.post('/reject', (req, res, next) => ocrController.reject(req, res, next));
router.post('/:documentId/reject', (req, res, next) => ocrController.reject(req, res, next));

export default router;
