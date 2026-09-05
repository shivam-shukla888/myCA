import { Router } from 'express';
import { chatController } from './chat.controller.js';
import { validateBody } from '../../middleware/validate.js';
import { sendChatSchema, monthlyReviewSchema } from './chat.schema.js';

const router = Router();

router.post(
  '/',
  validateBody(sendChatSchema),
  chatController.sendMessage.bind(chatController)
);

router.post(
  '/review',
  validateBody(monthlyReviewSchema),
  chatController.getMonthlyReview.bind(chatController)
);

export const chatRoutes = router;
