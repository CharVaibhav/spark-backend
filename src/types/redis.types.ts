// ─── Jobs (Express → Workers via Redis) ───────────────────────────────────────

export interface ValidateJob {
  runId: string;
  userId: string;
  idea: string;
  timestamp: string;
}

export interface BlueprintJob {
  runId: string;
  userId: string;
  idea: string;
  strategy: Record<string, unknown>;
  timestamp: string;
}

export interface ChatJob {
  jobId: string;
  userId: string;
  threadId: string;
  runId?: string;
  message: string;
  timestamp: string;
}

export interface ConsultantJob {
  reviewId: string;
  userId: string;
  ideaContext: string;
  timestamp: string;
}

export type RedisJob = ValidateJob | BlueprintJob | ChatJob | ConsultantJob;

// ─── Events (Workers → Express via Redis) ─────────────────────────────────────

export interface ChunkEvent {
  type: 'chunk';
  chunk: string;
}

export interface ResultEvent {
  type: 'strategy_ready' | 'blueprint_ready' | 'chat_done' | 'consultant_ready' | 'error';
  runId: string;
  data?: unknown;
  error?: string;
}
