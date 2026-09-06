import { Router } from 'express';
import { marketController } from './market.controller.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { addWatchlistSchema, removeWatchlistParamSchema } from './market.schema.js';

const router = Router();

router.get('/summary', (req, res, next) => marketController.getSummary(req, res, next));
router.post('/refresh', (req, res, next) => {
  req.query.refresh = 'true';
  marketController.getSummary(req, res, next);
});

router.get('/watchlist', (req, res, next) => marketController.getWatchlist(req, res, next));
router.post('/watchlist', validateBody(addWatchlistSchema), (req, res, next) =>
  marketController.addWatchlist(req, res, next)
);
router.delete('/watchlist/:symbol', validateParams(removeWatchlistParamSchema), (req, res, next) =>
  marketController.removeWatchlist(req, res, next)
);

export const marketRoutes = router;
