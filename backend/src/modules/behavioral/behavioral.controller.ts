import { Request, Response, NextFunction } from 'express';
import { behavioralService } from './behavioral.service.js';
import { BehavioralInsightsQuerySchema } from './behavioral.schema.js';
import { AppError } from '../../middleware/errorHandler.js';

export class BehavioralController {
  async getInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const query = BehavioralInsightsQuerySchema.parse(req.query);
      const result = await behavioralService.getBehavioralInsights(userId, query.month);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const behavioralController = new BehavioralController();
