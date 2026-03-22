// ─── Request Bodies ───────────────────────────────────────────────────────────

export interface CreateUserRequest {
  email: string;
  name: string;
  clerkId?: string;
}

export interface ValidateIdeaRequest {
  idea: string;
}

export interface GenerateBlueprintRequest {
  runId: string;
}

export interface ChatRequest {
  message: string;
  threadId: string;
  runId?: string;
}

export interface CreateThreadRequest {
  runId?: string;
}

// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

// ─── Augment Express Request ──────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
