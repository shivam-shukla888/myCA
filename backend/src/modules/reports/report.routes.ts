import { Router } from 'express';
import { reportController } from './report.controller.js';
import { validateBody } from '../../middleware/validate.js';
import { generateReportSchema } from './report.schema.js';

const router = Router();

router.post(
  '/generate',
  validateBody(generateReportSchema),
  reportController.generate.bind(reportController)
);

export const reportRoutes = router;
