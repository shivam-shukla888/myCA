import { Request, Response, NextFunction } from 'express';
import { transactionService } from './transaction.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class TransactionController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const result = await transactionService.createTransaction(userId, req.body);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const result = await transactionService.listTransactions(userId, req.query as any);
      res.status(200).json({ data: result.transactions, total: result.total });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const result = await transactionService.getTransactionById(userId, req.params.id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const result = await transactionService.updateTransaction(userId, req.params.id, req.body);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const result = await transactionService.deleteTransaction(userId, req.params.id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getMonthlySummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const month = req.query.month as string;
      const result = await transactionService.getMonthlySummary(userId, month);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const transactionController = new TransactionController();
