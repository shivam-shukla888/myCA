import { Router } from 'express';
import { documentController } from './document.controller.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import {
  createDocumentSchema,
  queryDocumentSchema,
  documentIdParamSchema,
} from './document.schema.js';

const router = Router();

router.post(
  '/',
  validateBody(createDocumentSchema),
  documentController.create.bind(documentController)
);

router.get(
  '/',
  validateQuery(queryDocumentSchema),
  documentController.list.bind(documentController)
);

router.get(
  '/:id',
  validateParams(documentIdParamSchema),
  documentController.getById.bind(documentController)
);

router.delete(
  '/:id',
  validateParams(documentIdParamSchema),
  documentController.delete.bind(documentController)
);

export const documentRoutes = router;
