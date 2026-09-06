import { Request, Response, NextFunction } from 'express';
import { croreService } from './crore.service.js';
import { simulateCroreSchema } from './crore.schema.js';
import { AppError } from '../../middleware/errorHandler.js';

export class CroreController {
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const month = req.query.month as string | undefined;
      const result = await croreService.getUserCroreStatus(userId, month);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async simulate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const parsed = simulateCroreSchema.parse(req.body);
      const result = await croreService.simulateShortestPath(userId, parsed);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const croreController = new CroreController();
