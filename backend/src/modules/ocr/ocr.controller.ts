import { Request, Response, NextFunction } from 'express';
import { ocrService } from './ocr.service.js';
import { confirmDocumentSchema } from './ocr.schema.js';

export class OCRController {
  async extract(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { documentId } = req.params;

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
      const { documentId } = req.params;

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
      const validated = confirmDocumentSchema.parse(req.body);

      const result = await ocrService.confirmAndImport(userId, validated);

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
