import { SendChatInput } from './chat.schema.js';
import { aiService } from '../ai/ai.service.js';
import { AppError } from '../../middleware/errorHandler.js';

export class ChatService {
  async processChatMessage(userId: string, input: SendChatInput) {
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
}

export const chatService = new ChatService();
