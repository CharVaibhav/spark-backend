// ─── Domain Models — mirror Turso table shapes ────────────────────────────────
// Note: Agents own the schema and write most of this data.
// This backend only reads these (except User which it creates).

export interface User {
  id: string;
  email: string;
  name: string;
  clerk_id?: string;
  available_credits: number;
  created_at: string;
}

export interface SparkRun {
  run_id: string;
  user_id: string;
  idea: string;
  status: 'pending' | 'researching' | 'strategy_ready' | 'generating_blueprint' | 'blueprint_ready' | 'failed';
  product_name?: string;
  strategy?: Record<string, unknown>;
  blueprint?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChatThread {
  thread_id: string;
  user_id: string;
  run_id?: string;
  title?: string;
  created_at: string;
}

export interface ChatMessage {
  message_id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}
