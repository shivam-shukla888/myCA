import { Request, Response, NextFunction } from 'express';
import { documentService } from './document.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class DocumentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
      }
      const result = await documentService.createDocumentMetadata(userId, req.body);
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
      const result = await documentService.listDocuments(userId, req.query as any);
      res.status(200).json({ data: result.documents, total: result.total });
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
      const result = await documentService.getDocumentById(userId, req.params.id);
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
      const result = await documentService.deleteDocument(userId, req.params.id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const documentController = new DocumentController();
