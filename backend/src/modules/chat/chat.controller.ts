import { Request, Response, NextFunction } from 'express';
import { chatService } from './chat.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class ChatController {
  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const result = await chatService.processChatMessage(userId, req.body);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const chatController = new ChatController();
