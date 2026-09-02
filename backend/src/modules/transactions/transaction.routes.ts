import { Router } from 'express';
import { transactionController } from './transaction.controller.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  queryTransactionSchema,
  transactionIdParamSchema,
} from './transaction.schema.js';

const router = Router();

router.post(
  '/',
  validateBody(createTransactionSchema),
  transactionController.create.bind(transactionController)
);

router.get(
  '/',
  validateQuery(queryTransactionSchema),
  transactionController.list.bind(transactionController)
);

router.get(
  '/:id',
  validateParams(transactionIdParamSchema),
  transactionController.getById.bind(transactionController)
);

router.put(
  '/:id',
  validateParams(transactionIdParamSchema),
  validateBody(updateTransactionSchema),
  transactionController.update.bind(transactionController)
);

router.delete(
  '/:id',
  validateParams(transactionIdParamSchema),
  transactionController.delete.bind(transactionController)
);

export const transactionRoutes = router;
