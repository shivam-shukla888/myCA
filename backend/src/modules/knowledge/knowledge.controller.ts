import { Request, Response, NextFunction } from 'express';
import { knowledgeService } from './knowledge.service.js';
import {
  ingestKnowledgeSourceSchema,
  updateKnowledgeSourceStatusSchema,
  queryKnowledgeSourceSchema,
} from './knowledge.schema.js';
import { retrievalQuerySchema } from './retrieval/rag.schema.js';
import { AppError } from '../../middleware/errorHandler.js';

export class KnowledgeController {
  async ingestSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = ingestKnowledgeSourceSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(parseResult.error.errors[0].message, 400, 'INVALID_REQUEST');
      }

      const result = await knowledgeService.ingestSource(parseResult.data);
      res.status(201).json({
        data: result,
        message: 'Knowledge source ingested with verified provenance',
      });
    } catch (err) {
      next(err);
    }
  }

  async updateSourceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceId } = req.params;
      if (!sourceId) throw new AppError('sourceId is required', 400, 'INVALID_PARAM');

      const parseResult = updateKnowledgeSourceStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(parseResult.error.errors[0].message, 400, 'INVALID_REQUEST');
      }

      const result = await knowledgeService.updateSourceStatus(
        sourceId,
        parseResult.data.status,
        parseResult.data.reason
      );

      res.status(200).json({
        data: result,
        message: `Knowledge source status updated to ${parseResult.data.status}`,
      });
    } catch (err) {
      next(err);
    }
  }

  async listSources(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = queryKnowledgeSourceSchema.safeParse(req.query);
      if (!parseResult.success) {
        throw new AppError(parseResult.error.errors[0].message, 400, 'INVALID_REQUEST');
      }

      const result = await knowledgeService.listSources(parseResult.data);
      res.status(200).json({
        data: result.sources,
        total: result.total,
        limit: parseResult.data.limit,
        offset: parseResult.data.offset,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceId } = req.params;
      if (!sourceId) throw new AppError('sourceId is required', 400, 'INVALID_PARAM');

      const version = req.query.version ? parseInt(req.query.version as string, 10) : undefined;
      const result = await knowledgeService.getSource(sourceId, version);

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getChunkProvenance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chunkId } = req.params;
      if (!chunkId) throw new AppError('chunkId is required', 400, 'INVALID_PARAM');

      const provenance = await knowledgeService.getChunkProvenance(chunkId);
      res.status(200).json({ data: provenance });
    } catch (err) {
      next(err);
    }
  }

  async retrieveKnowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = retrievalQuerySchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(parseResult.error.errors[0].message, 400, 'INVALID_REQUEST');
      }

      const result = await knowledgeService.retrieveKnowledge(parseResult.data);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const knowledgeController = new KnowledgeController();
