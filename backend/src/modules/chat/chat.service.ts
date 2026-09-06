import { SendChatInput, MonthlyReviewInput } from './chat.schema.js';
import { aiService } from '../ai/ai.service.js';
import { financialContextService } from '../ai/financialContext.service.js';
import { monthlyReviewService } from '../finance/monthlyReview.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class ChatService {
  async processChatMessage(userId: string, input: SendChatInput, options?: { includeAdvancedDetails?: boolean }) {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    try {
      const result = await aiService.processUserMessage(userId, input.message, {
        conversationId: input.conversation_id,
      });

      return result;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`AI Processing failed: ${err.message}`, 500, 'AI_PROCESSING_ERROR');
    }
  }

  async generateMonthlyReview(userId: string, input: MonthlyReviewInput) {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    try {
      const now = new Date();
      const month = input.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const query = `Please provide my comprehensive Monthly Financial Review for ${month}. Summarize my income, expenses, surplus, what went well, main pressure points, and next action.`;

      const result = await aiService.processUserMessage(userId, query, {
        conversationId: input.conversation_id,
      });

      const deterministicContext = await financialContextService.buildDeterministicContext(userId, month);
      const structuredReview = await monthlyReviewService.getMonthlyReview(userId, month).catch(() => null);

      return {
        ...result,
        deterministic_context: deterministicContext,
        structured_review: structuredReview,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Monthly Review generation failed: ${err.message}`, 500, 'AI_PROCESSING_ERROR');
    }
  }
}

export const chatService = new ChatService();
