import { Request, Response } from 'express';
import { actionService } from './action.service.js';
import {
  generateActionPlanSchema,
  simulateActionPlanSchema,
} from './action.schema.js';
import { AppError } from '../../middleware/errorHandler.js';

export class ActionController {
  async getPlan(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const month = (req.query.month as string) || this.getCurrentMonthStr();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new AppError('Month must be in YYYY-MM format', 400, 'INVALID_MONTH_FORMAT');
    }

    const plan = await actionService.getActionPlanForMonth(userId, month);
    res.status(200).json(plan);
  }

  async generatePlan(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const parseResult = generateActionPlanSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, 'INVALID_REQUEST');
    }

    const month = parseResult.data.month || this.getCurrentMonthStr();
    const plan = await actionService.generateActionPlan(userId, month, parseResult.data.overrides);
    res.status(200).json(plan);
  }

  async confirmPlan(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const parseResult = generateActionPlanSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, 'INVALID_REQUEST');
    }

    const month = parseResult.data.month || this.getCurrentMonthStr();
    const confirmed = await actionService.confirmActionPlan(userId, month, parseResult.data.overrides);
    res.status(201).json(confirmed);
  }

  async simulatePlan(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const parseResult = simulateActionPlanSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, 'INVALID_REQUEST');
    }

    const simulation = await actionService.simulateActionPlan(userId, parseResult.data);
    res.status(200).json(simulation);
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const history = await actionService.getActionPlanHistory(userId);
    res.status(200).json(history);
  }

  private getCurrentMonthStr(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

export const actionController = new ActionController();
