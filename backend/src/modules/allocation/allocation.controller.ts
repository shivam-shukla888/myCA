import { Request, Response, NextFunction } from 'express';
import { allocationService } from './allocation.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class AllocationController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      const profile = await allocationService.getProfile(userId);
      res.status(200).json({ data: profile });
    } catch (err) {
      next(err);
    }
  }

  async upsertProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      const profile = await allocationService.upsertProfile(userId, req.body);
      res.status(200).json({ data: profile });
    } catch (err) {
      next(err);
    }
  }

  async listGoals(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      const goals = await allocationService.listGoals(userId);
      res.status(200).json({ data: goals });
    } catch (err) {
      next(err);
    }
  }

  async createGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      const goal = await allocationService.createGoal(userId, req.body);
      res.status(201).json({ data: goal });
    } catch (err) {
      next(err);
    }
  }

  async updateGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      const goal = await allocationService.updateGoal(userId, req.params.id, req.body);
      res.status(200).json({ data: goal });
    } catch (err) {
      next(err);
    }
  }

  async deleteGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      const result = await allocationService.deleteGoal(userId, req.params.id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async generatePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      const plan = await allocationService.generatePlanForMonth(userId, req.body.month);
      res.status(201).json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async getPlanForMonth(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      const plan = await allocationService.getPlanForMonth(userId, req.params.month);
      if (!plan) {
        return next(new AppError('Allocation plan for month not found', 404, 'PLAN_NOT_FOUND'));
      }
      res.status(200).json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async listPlanHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      const history = await allocationService.listPlanHistory(userId);
      res.status(200).json({ data: history });
    } catch (err) {
      next(err);
    }
  }
}

export const allocationController = new AllocationController();
