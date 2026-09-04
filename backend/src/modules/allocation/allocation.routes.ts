import { Router } from 'express';
import { z } from 'zod';
import { allocationController } from './allocation.controller.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import {
  financialProfileSchema,
  goalSchema,
  updateGoalSchema,
  generatePlanSchema,
} from './allocation.schema.js';

const goalIdParamSchema = z.object({
  id: z.string().uuid('Goal ID must be a valid UUID'),
});

const planMonthParamSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format (01-12)'),
});

const router = Router();

// Profile endpoints
router.get('/profile', allocationController.getProfile.bind(allocationController));
router.put(
  '/profile',
  validateBody(financialProfileSchema),
  allocationController.upsertProfile.bind(allocationController)
);

// Goals endpoints
router.get('/goals', allocationController.listGoals.bind(allocationController));
router.post(
  '/goals',
  validateBody(goalSchema),
  allocationController.createGoal.bind(allocationController)
);
router.put(
  '/goals/:id',
  validateParams(goalIdParamSchema),
  validateBody(updateGoalSchema),
  allocationController.updateGoal.bind(allocationController)
);
router.delete(
  '/goals/:id',
  validateParams(goalIdParamSchema),
  allocationController.deleteGoal.bind(allocationController)
);

// Plan generation & history endpoints
router.post(
  '/plans/generate',
  validateBody(generatePlanSchema),
  allocationController.generatePlan.bind(allocationController)
);
router.get('/plans/history', allocationController.listPlanHistory.bind(allocationController));
router.get(
  '/plans/:month',
  validateParams(planMonthParamSchema),
  allocationController.getPlanForMonth.bind(allocationController)
);

export const allocationRoutes = router;
