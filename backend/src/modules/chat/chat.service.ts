import { v4 as uuidv4 } from 'uuid';
import { SendChatInput } from './chat.schema.js';
import { AppError } from '../../middleware/errorHandler.js';

export interface ChatBoundaryResponse {
  status: 'service_boundary_active';
  conversation_id: string;
  query_received: string;
  context_type: string;
  ai_layer_status: 'PENDING_STEP_5_AI_INTEGRATION';
  disclaimer: string;
  safety_protocol: string;
}

export class ChatService {
  async processChatMessage(userId: string, input: SendChatInput): Promise<ChatBoundaryResponse> {
    if (!userId) {
      throw new AppError('User context is required', 401, 'UNAUTHORIZED');
    }

    const conversationId = input.conversation_id || uuidv4();

    // Controlled boundary response - strictly avoids generating fabricated tax/investment answers
    return {
      status: 'service_boundary_active',
      conversation_id: conversationId,
      query_received: input.message,
      context_type: input.context_type,
      ai_layer_status: 'PENDING_STEP_5_AI_INTEGRATION',
      disclaimer: 'Personal AI CA is operating in Step 3 (Backend Core). Full AI reasoning, Gemini integration, and RAG retrieval will be wired in Step 5.',
      safety_protocol: 'ENFORCED: No unverified financial recommendations or tax conclusions generated.',
    };
  }
}

export const chatService = new ChatService();
