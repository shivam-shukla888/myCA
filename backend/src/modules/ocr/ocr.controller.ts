import { Request, Response, NextFunction } from 'express';
import { ocrService } from './ocr.service.js';
import { confirmDocumentSchema, rejectDocumentSchema } from './ocr.schema.js';

export class OCRController {
  async extract(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const documentId = req.params.documentId || req.params.id;

      const result = await ocrService.extractDocument(userId, documentId);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const documentId = req.params.documentId || req.params.id;

      const draft = await ocrService.getDraft(userId, documentId);

      res.status(200).json({
        status: 'success',
        data: draft,
      });
    } catch (error) {
      next(error);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const payload = {
        ...req.body,
        document_id: req.body.document_id || req.params.documentId || req.params.id,
      };
      const validated = confirmDocumentSchema.parse(payload);

      const result = await ocrService.confirmAndImport(userId, validated);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const payload = {
        ...req.body,
        document_id: req.body.document_id || req.params.documentId || req.params.id,
      };
      const validated = rejectDocumentSchema.parse(payload);

      const result = await ocrService.rejectDocument(userId, validated);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const ocrController = new OCRController();
