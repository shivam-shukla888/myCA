import { Router, Request, Response, NextFunction } from 'express';
import { canonicalFinanceService } from './canonicalFinance.service.js';
import { monthlyReviewService } from './monthlyReview.service.js';
import { MonthlyReviewQuerySchema } from './monthlyReview.schema.js';
import { changeDetectionService } from './changeDetection.service.js';
import { ChangeDetectionQuerySchema } from './changeDetection.schema.js';
import { AppError } from '../../middleware/errorHandler.js';

export const canonicalFinanceRoutes = Router();

canonicalFinanceRoutes.get('/canonical', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || (req.headers['x-dev-user-id'] as string);
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const month = req.query.month ? String(req.query.month) : undefined;
    const state = await canonicalFinanceService.getCanonicalFinancialState(userId, month);
    res.status(200).json({
      success: true,
      data: state,
    });
  } catch (err) {
    next(err);
  }
});

canonicalFinanceRoutes.get('/monthly-review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || (req.headers['x-dev-user-id'] as string);
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const query = MonthlyReviewQuerySchema.parse(req.query);
    const review = await monthlyReviewService.getMonthlyReview(userId, query.month);
    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (err) {
    next(err);
  }
});

canonicalFinanceRoutes.get('/changes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || (req.headers['x-dev-user-id'] as string);
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const query = ChangeDetectionQuerySchema.parse(req.query);
    const result = await changeDetectionService.detectChanges(userId, query.month, query.previous_month);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});


