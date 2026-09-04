import { Request, Response } from 'express';
import { freedomService } from './freedom.service.js';
import { freedomSimulationInputSchema, updatePlanningAssumptionsSchema } from './freedom.schema.js';

export class FreedomController {
  /**
   * GET /api/v1/freedom/status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized: User authentication required' });
        return;
      }

      const status = await freedomService.getFreedomStatus(userId);
      res.status(200).json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to calculate financial freedom status' });
    }
  }

  /**
   * POST /api/v1/freedom/simulate
   * Ephemeral what-if calculation without database writes
   */
  async simulate(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized: User authentication required' });
        return;
      }

      const parseResult = freedomSimulationInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.errors,
        });
        return;
      }

      const simulation = await freedomService.simulate(userId, parseResult.data);
      res.status(200).json(simulation);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Simulation failed' });
    }
  }

  /**
   * PUT /api/v1/freedom/assumptions
   * Persists planning assumptions to financial profile
   */
  async saveAssumptions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized: User authentication required' });
        return;
      }

      const parseResult = updatePlanningAssumptionsSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.errors,
        });
        return;
      }

      const updated = await freedomService.saveAssumptions(userId, parseResult.data);
      res.status(200).json({
        message: 'Planning assumptions successfully updated',
        profile: updated,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save assumptions' });
    }
  }
}

export const freedomController = new FreedomController();
