import { Request, Response, NextFunction } from 'express';
import { marketService } from './market.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class MarketController {
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const summary = await marketService.getMarketSummary(forceRefresh);
      res.status(200).json({ data: summary });
    } catch (err) {
      next(err);
    }
  }

  async getWatchlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const watchlist = await marketService.getWatchlist(userId);
      res.status(200).json({ data: watchlist });
    } catch (err) {
      next(err);
    }
  }

  async addWatchlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const item = await marketService.addWatchlistSymbol(userId, req.body);
      res.status(201).json({ data: item });
    } catch (err) {
      next(err);
    }
  }

  async removeWatchlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const result = await marketService.removeWatchlistSymbol(userId, req.params.symbol);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const marketController = new MarketController();
