import { Router } from 'express';
import { croreController } from './crore.controller.js';

const router = Router();

router.get('/status', (req, res, next) => croreController.getStatus(req, res, next));
router.post('/simulate', (req, res, next) => croreController.simulate(req, res, next));

export default router;
