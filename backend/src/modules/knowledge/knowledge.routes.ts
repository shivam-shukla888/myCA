import { Router } from 'express';
import { knowledgeController } from './knowledge.controller.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

const router = Router();

// Publicly readable for all authenticated users
router.get(
  '/sources',
  requireAuth,
  knowledgeController.listSources.bind(knowledgeController)
);

router.get(
  '/sources/:sourceId',
  requireAuth,
  knowledgeController.getSource.bind(knowledgeController)
);

router.get(
  '/chunks/:chunkId/provenance',
  requireAuth,
  knowledgeController.getChunkProvenance.bind(knowledgeController)
);

// RAG Retrieval Endpoint (Authenticated)
router.post(
  '/retrieve',
  requireAuth,
  knowledgeController.retrieveKnowledge.bind(knowledgeController)
);

// Admin-only mutation endpoints
router.post(
  '/sources',
  requireAuth,
  requireRole('ADMIN'),
  knowledgeController.ingestSource.bind(knowledgeController)
);

router.patch(
  '/sources/:sourceId/status',
  requireAuth,
  requireRole('ADMIN'),
  knowledgeController.updateSourceStatus.bind(knowledgeController)
);

export const knowledgeRoutes = router;
