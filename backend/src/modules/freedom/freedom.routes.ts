import { Router } from 'express';
import { freedomController } from './freedom.controller.js';

const router = Router();

router.get('/status', (req, res) => freedomController.getStatus(req, res));
router.post('/simulate', (req, res) => freedomController.simulate(req, res));
router.put('/assumptions', (req, res) => freedomController.saveAssumptions(req, res));

export default router;
