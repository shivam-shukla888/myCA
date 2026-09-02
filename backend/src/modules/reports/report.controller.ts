import { Request, Response, NextFunction } from 'express';
import { reportService } from './report.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class ReportController {
  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const result = await reportService.generateReport(userId, req.body);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const reportController = new ReportController();
