import { RequestHandler } from 'express';
import * as chatService from '../services/chat.service.js';
import * as redisService from '../services/redis.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { initSSE, sendSSEEvent, sendSSEError } from '../utils/sse.js';
import { ChatRequest, CreateThreadRequest } from '../types/api.types.js';

/** POST /api/chat/thread — create a new chat thread */
export const createThread: RequestHandler = asyncHandler(async (req, res) => {
  const { runId } = req.body as CreateThreadRequest;
  const result = await chatService.createThread(req.userId!, runId);
  res.status(201).json({ success: true, data: result });
});

/** POST /api/chat/message — send a message (returns jobId for SSE) */
export const sendMessage: RequestHandler = asyncHandler(async (req, res) => {
  const { message, threadId, runId } = req.body as ChatRequest;
  const jobId = await chatService.initiateChat(req.userId!, threadId, message, runId);
  res.status(202).json({ success: true, data: { jobId } });
});

/** GET /api/chat/events/:jobId — SSE stream for chat response */
export const streamChatEvents: RequestHandler = async (req, res) => {
  const { jobId } = req.params;

  initSSE(res);

  const unsubscribe = await redisService.subscribeToResult(
    jobId,
    (chunk) => sendSSEEvent(res, 'chunk', { chunk }),
    (event) => {
      sendSSEEvent(res, event.type, event);
      if (['chat_done', 'error'].includes(event.type)) {
        unsubscribe();
        res.end();
      }
    },
    (err) => {
      sendSSEError(res, err.message);
      unsubscribe();
    }
  );

  req.on('close', () => unsubscribe());
};

/** GET /api/chat/threads — list all threads for the current user */
export const getThreads: RequestHandler = asyncHandler(async (req, res) => {
  const threads = await chatService.getThreadsByUser(req.userId!);
  res.json({ success: true, data: threads });
});

/** GET /api/chat/threads/:threadId/messages — load message history for a thread */
export const getMessages: RequestHandler = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const messages = await chatService.getMessagesByThread(threadId);
  res.json({ success: true, data: messages });
});
