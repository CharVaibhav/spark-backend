import { Response } from 'express';

/** Set SSE headers and send the initial connected event */
export function initSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();
  res.write('event: connected\ndata: {}\n\n');
}

/** Send a named SSE event with JSON data */
export function sendSSEEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  // @ts-ignore — res.flush() exists in some middleware stacks (compression)
  if (typeof res.flush === 'function') res.flush();
}

/** Send an error event and close the SSE connection */
export function sendSSEError(res: Response, message: string): void {
  sendSSEEvent(res, 'error', { error: message });
  res.end();
}
