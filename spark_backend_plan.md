# Spark Backend — Complete Build Plan
### Express.js + Redis Pub/Sub + Mastra Workers

---

## Why Redis Pub/Sub?

Agent calls take **30-90 seconds** (research crawls the web). If Express handles them directly, requests timeout and HTTP connections die. With Redis:

```
Client → POST /api/spark/validate
           ↓ publishes job to Redis channel: spark:validate
           ↓ returns { runId } immediately (200ms)

Worker (separate process) ← subscribes to spark:validate
  → runs researchAgent + pmAgent (~60s)
  → publishes result to Redis channel: spark:result:{runId}

Client ← GET /api/spark/events/:runId (SSE)
  → Express subscribes to spark:result:{runId}
  → streams chunks to browser as they come in
```

---

## Repository Structure (30 files total)

```
spark-api/
├── src/
│   ├── config/              (2 files)
│   ├── db/                  (3 files)
│   ├── middleware/          (4 files)
│   ├── routes/              (4 files)
│   ├── controllers/         (3 files)
│   ├── services/            (4 files)
│   ├── workers/             (4 files)
│   ├── types/               (3 files)
│   ├── utils/               (3 files)
│   ├── app.ts
│   └── server.ts
├── .env.example
├── package.json
└── tsconfig.json
```

---

## PHASE 1 — Project Scaffolding (Build First)

---

### FILE 1: [package.json](file:///e:/spark/spark/package.json)

**What it does:** Declares all dependencies and scripts.

**Build prompt:**
```
Create package.json for a Node.js TypeScript Express server called "spark-api".

Dependencies:
- express, cors, helmet, compression
- ioredis (Redis client)
- better-sqlite3 (SQLite DB, same as Mastra's LibSQL)
- zod (validation)
- jsonwebtoken, @clerk/backend (auth)
- express-rate-limit
- winston (logging)
- dotenv
- uuid

Dev dependencies:
- typescript, tsx, ts-node
- @types/express, @types/node, @types/better-sqlite3, @types/jsonwebtoken
- nodemon

Scripts:
- "dev": "nodemon --exec tsx src/server.ts"
- "dev:worker": "tsx src/workers/index.ts"
- "build": "tsc"
- "start": "node dist/server.js"
- "start:worker": "node dist/workers/index.js"

Type: "module"
```

---

### FILE 2: `tsconfig.json`

**What it does:** TypeScript config with ESM support.

**Build prompt:**
```
Create tsconfig.json for a Node.js ESM TypeScript project.

Settings:
- target: ES2022
- module: NodeNext
- moduleResolution: NodeNext
- outDir: ./dist
- rootDir: ./src
- strict: true
- esModuleInterop: true
- resolveJsonModule: true
- skipLibCheck: true
```

---

### FILE 3: `.env.example`

**What it does:** Documents all required environment variables.

**Build prompt:**
```
Create .env.example with these variables:

# Server
PORT=3001
NODE_ENV=development

# Redis
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=file:../spark/mastra.db   # same DB as Mastra

# Auth
JWT_SECRET=your-secret-here
CLERK_SECRET_KEY=sk_test_...

# AI Keys (same as Mastra .env)
GOOGLE_GENERATIVE_AI_API_KEY=...
EXA_API_KEY=...

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

## PHASE 2 — Config & Infrastructure

---

### FILE 4: `src/config/env.ts`

**What it does:** Validates and exports all env variables with type safety. Throws at startup if anything is missing.

**Build prompt:**
```
Create src/config/env.ts that:
1. Uses zod to define and validate ALL environment variables from .env
2. Throws a clear error at startup if any required variable is missing
3. Exports a typed `env` object (e.g., env.PORT, env.REDIS_URL, env.DATABASE_URL)
4. In development, loads dotenv automatically
5. Optional variables (CLERK_SECRET_KEY) should use .optional()
```

---

### FILE 5: `src/config/redis.ts`

**What it does:** Creates and exports two Redis clients (one for publishing, one for subscribing — Redis requires separate connections for pub/sub).

**Build prompt:**
```
Create src/config/redis.ts that:
1. Imports ioredis
2. Creates TWO Redis clients:
   - `publisher`: for sending jobs and events
   - `subscriber`: for listening to channels (cannot publish on same connection)
3. Both connect to env.REDIS_URL
4. Both log connection status (connected, error, reconnecting) via winston logger
5. Exports both: export { publisher, subscriber }
6. Defines CHANNEL constants at top:
   CHANNELS = {
     VALIDATE_JOB: 'spark:job:validate',
     BLUEPRINT_JOB: 'spark:job:blueprint',
     CHAT_JOB: 'spark:job:chat',
     RESULT: (runId: string) => `spark:result:${runId}`,
     CHUNK: (runId: string) => `spark:chunk:${runId}`,
   }
```

---

### FILE 6: `src/config/db.ts`

**What it does:** Sets up better-sqlite3 connection and runs migrations on startup.

**Build prompt:**
```
Create src/config/db.ts that:
1. Imports better-sqlite3
2. Opens the DB at env.DATABASE_URL (strip the "file:" prefix for better-sqlite3)
3. Enables WAL mode for concurrent reads: db.pragma('journal_mode = WAL')
4. Runs table migrations inline on startup (not separate files — keep it simple):

   CREATE TABLE IF NOT EXISTS spark_runs (
     run_id TEXT PRIMARY KEY,
     user_id TEXT,
     idea TEXT NOT NULL,
     status TEXT DEFAULT 'pending',
     product_name TEXT,
     strategy_json TEXT,
     blueprint_json TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );

   CREATE TABLE IF NOT EXISTS chat_threads (
     thread_id TEXT PRIMARY KEY,
     user_id TEXT,
     run_id TEXT,
     title TEXT,
     created_at TEXT NOT NULL
   );

5. Exports the db instance
```

---

## PHASE 3 — Types

---

### FILE 7: `src/types/redis.types.ts`

**What it does:** TypeScript types for all Redis job payloads and result events.

**Build prompt:**
```
Create src/types/redis.types.ts with these interfaces:

// Jobs (what Express publishes TO workers)
interface ValidateJob {
  runId: string;
  userId: string;
  idea: string;
  timestamp: string;
}

interface BlueprintJob {
  runId: string;
  userId: string;
  strategy: MVPStrategy;   // import from mastra
  idea: string;
  timestamp: string;
}

interface ChatJob {
  jobId: string;
  userId: string;
  threadId: string;
  runId?: string;          // optional — link chat to a spark run
  message: string;
  timestamp: string;
}

// Events (what workers publish BACK to Express)
interface ChunkEvent {
  type: 'chunk';
  runId: string;
  chunk: string;           // partial text for streaming
}

interface ResultEvent {
  type: 'strategy_ready' | 'blueprint_ready' | 'chat_done' | 'error';
  runId: string;
  data?: any;
  error?: string;
}

Export all as a union: RedisJob = ValidateJob | BlueprintJob | ChatJob
```

---

### FILE 8: `src/types/api.types.ts`

**What it does:** Request/response types for all API endpoints.

**Build prompt:**
```
Create src/types/api.types.ts with typed request bodies and API responses:

// Request bodies
interface ValidateIdeaRequest { idea: string }
interface GenerateBlueprintRequest { runId: string }
interface ChatRequest { message: string; threadId: string; runId?: string }
interface MarkStepRequest { stepIndex: number }

// API responses
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface SparkRunResponse {
  runId: string;
  status: string;
  productName?: string;
  strategy?: any;
  blueprint?: any;
  createdAt: string;
}

// Augment Express Request to include userId (set by auth middleware)
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
```

---

### FILE 9: `src/types/spark.types.ts`

**What it does:** Re-exports Mastra schema types for use across the backend without importing from the Mastra package directly.

**Build prompt:**
```
Create src/types/spark.types.ts that:
1. Imports MVPStrategy type from the spark mastra package (../../spark/src/mastra/agents/pmAgent)
2. Imports SystemArchitecture from arcagent
3. Re-exports them as named exports
4. Also defines:

interface SparkRun {
  runId: string;
  userId: string;
  idea: string;
  status: 'pending' | 'researching' | 'strategy_ready' | 'blueprint_ready' | 'failed';
  productName?: string;
  strategy?: MVPStrategy;
  blueprint?: SystemArchitecture;
  createdAt: string;
  updatedAt: string;
}
```

---

## PHASE 4 — Utils & Middleware

---

### FILE 10: `src/utils/logger.ts`

**What it does:** Winston logger with pretty dev output and JSON production output.

**Build prompt:**
```
Create src/utils/logger.ts using winston:
1. In development: colorized console output with timestamp
2. In production: JSON format
3. Log levels: error, warn, info, debug
4. Export default logger instance
5. Also export child logger factory: createLogger(module: string)
   → adds { module } metadata to every log line
   → Usage: const log = createLogger('spark.controller')
```

---

### FILE 11: `src/utils/sse.ts`

**What it does:** Helper to set up SSE headers and write events to a response. Used by all streaming routes.

**Build prompt:**
```
Create src/utils/sse.ts with:

function initSSE(res: Response): void
  - Sets headers: Content-Type: text/event-stream, Cache-Control: no-cache,
    Connection: keep-alive, X-Accel-Buffering: no
  - Sends initial "connected" event
  - Calls res.flushHeaders()

function sendSSEEvent(res: Response, event: string, data: any): void
  - Writes: event: ${event}\ndata: ${JSON.stringify(data)}\n\n
  - Calls res.flush() if available

function sendSSEError(res: Response, message: string): void
  - Sends error event then ends the response

Export all three functions.
```

---

### FILE 12: `src/utils/id.ts`

**What it does:** Consistent ID generation for runIds, threadIds, jobIds.

**Build prompt:**
```
Create src/utils/id.ts that exports:
- generateRunId(): string  → "run_" + nanoid(12)
- generateThreadId(): string → "thread_" + nanoid(12)
- generateJobId(): string → "job_" + nanoid(12)

Use the `uuid` package (v4) or `crypto.randomUUID()` — no external dependency needed.
Prefix each type so IDs are self-describing in logs.
```

---

### FILE 13: `src/middleware/auth.ts`

**What it does:** Validates JWT token from Authorization header. Sets `req.userId`.

**Build prompt:**
```
Create src/middleware/auth.ts:

const authMiddleware: RequestHandler = async (req, res, next) => {
  1. Extract token from: Authorization: Bearer <token>
  2. If no token → 401 { success: false, error: 'No token provided' }
  3. Verify using jsonwebtoken with env.JWT_SECRET
  4. Set req.userId = decoded.sub
  5. Call next()
  6. On any error → 401 { success: false, error: 'Invalid token' }
}

Also export optionalAuth middleware (same but calls next() even without token,
just sets req.userId if present — used for public routes that are enhanced when authed)

Export both.
```

---

### FILE 14: `src/middleware/validate.ts`

**What it does:** Zod request body validation middleware factory.

**Build prompt:**
```
Create src/middleware/validate.ts:

function validate<T>(schema: z.ZodSchema<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors
      });
    }
    req.body = result.data;  // replace with parsed/coerced data
    next();
  };
}

export { validate }
```

---

### FILE 15: `src/middleware/errorHandler.ts`

**What it does:** Global error handler — catches anything thrown in controllers.

**Build prompt:**
```
Create src/middleware/errorHandler.ts:

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  1. Log the error with logger.error (include req.method, req.path, err.message, err.stack)
  2. If err.statusCode exists, use it; otherwise 500
  3. In production: never expose stack traces
  4. In development: include err.stack in response
  5. Always return: { success: false, error: message }
}

Also create a custom AppError class:
class AppError extends Error {
  constructor(public statusCode: number, message: string) { super(message) }
}

Export both.
```

---

### FILE 16: `src/middleware/rateLimiter.ts`

**What it does:** Rate limiting to prevent abuse of expensive AI routes.

**Build prompt:**
```
Create src/middleware/rateLimiter.ts using express-rate-limit:

Export three limiters:
1. apiLimiter — 100 requests per 15 minutes (general)
2. sparkLimiter — 10 requests per hour per IP (validate/blueprint — expensive)
3. chatLimiter — 30 requests per minute per IP (chat messages)

Each returns a clear JSON error with retry-after when exceeded:
{ success: false, error: 'Too many requests', retryAfter: N }
```

---

## PHASE 5 — Services

---

### FILE 17: `src/services/redis.service.ts`

**What it does:** All Redis pub/sub logic in one place. Controllers and workers import from here.

**Build prompt:**
```
Create src/services/redis.service.ts:

1. publishJob(channel: string, payload: object): Promise<void>
   → JSON.stringify(payload) and publisher.publish(channel, data)
   → logs: "Published job to channel: X, runId: Y"

2. subscribeToResult(
     runId: string,
     onChunk: (chunk: string) => void,
     onResult: (event: ResultEvent) => void,
     onError: (err: Error) => void
   ): Promise<() => void>   // returns unsubscribe function
   → Creates a LOCAL subscriber instance (each SSE connection needs its own)
   → Subscribes to CHANNELS.CHUNK(runId) and CHANNELS.RESULT(runId)
   → Parses messages and calls appropriate callback
   → Returns cleanup function that unsubscribes and disconnects

3. publishChunk(runId: string, chunk: string): Promise<void>
   → Used by workers to stream partial output
   → publisher.publish(CHANNELS.CHUNK(runId), JSON.stringify({ type: 'chunk', chunk }))

4. publishResult(runId: string, event: ResultEvent): Promise<void>
   → Used by workers when done
```

---

### FILE 18: `src/services/blueprint.service.ts`

**What it does:** All database operations for spark runs.

**Build prompt:**
```
Create src/services/blueprint.service.ts using the db instance:

Functions (all synchronous since better-sqlite3 is sync):

createRun(data: { runId, userId, idea }): SparkRun
  → INSERT into spark_runs, status = 'pending'

updateRunStatus(runId: string, status: string): void
  → UPDATE spark_runs SET status = ?, updated_at = ? WHERE run_id = ?

saveStrategy(runId: string, strategy: MVPStrategy): void
  → UPDATE spark_runs SET strategy_json = ?, product_name = ?, status = 'strategy_ready'

saveBlueprint(runId: string, blueprint: SystemArchitecture): void
  → UPDATE spark_runs SET blueprint_json = ?, status = 'blueprint_ready'

getRun(runId: string): SparkRun | null
  → SELECT + JSON.parse strategy_json and blueprint_json

getRunsByUser(userId: string, limit = 10): SparkRun[]
  → SELECT last 10 runs for userId, ordered by created_at DESC

deleteRun(runId: string, userId: string): boolean
  → DELETE + verify ownership

Export all as blueprintService object.
```

---

### FILE 19: `src/services/spark.service.ts`

**What it does:** Business logic for the validate and blueprint flows. Called by controllers.

**Build prompt:**
```
Create src/services/spark.service.ts:

async function initiateValidation(userId: string, idea: string): Promise<string>
  1. Generate runId using generateRunId()
  2. Create the DB run record via blueprintService.createRun()
  3. Publish ValidateJob to CHANNELS.VALIDATE_JOB via redisService.publishJob()
  4. Update status to 'researching'
  5. Return runId

async function initiateBlueprintGeneration(runId: string, userId: string): Promise<void>
  1. Fetch run from DB, verify it belongs to userId
  2. Check status === 'strategy_ready', throw AppError(400) if not
  3. Publish BlueprintJob to CHANNELS.BLUEPRINT_JOB
  4. Update status to 'generating_blueprint'

Export both.
```

---

### FILE 20: `src/services/chat.service.ts`

**What it does:** Business logic for the consultant chat.

**Build prompt:**
```
Create src/services/chat.service.ts:

async function initiateChat(userId: string, threadId: string, message: string, runId?: string): Promise<string>
  1. Generate jobId
  2. Publish ChatJob to CHANNELS.CHAT_JOB
  3. Return jobId (used to subscribe to results)

function createThread(userId: string, runId?: string): { threadId: string }
  1. Generate threadId
  2. INSERT into chat_threads
  3. Return { threadId }

function getThreadsByUser(userId: string): ChatThread[]
  → SELECT all threads for userId

Export as chatService object.
```

---

## PHASE 6 — Workers (The Mastra Bridge)

---

### FILE 21: `src/workers/validate.worker.ts`

**What it does:** Subscribes to validate jobs. Runs the Mastra validation workflow. Publishes results back to Redis.

**Build prompt:**
```
Create src/workers/validate.worker.ts:

export async function startValidateWorker(): Promise<void> {
  const workerSub = new Redis(env.REDIS_URL);

  workerSub.subscribe(CHANNELS.VALIDATE_JOB);

  workerSub.on('message', async (channel, message) => {
    const job: ValidateJob = JSON.parse(message);
    const { runId, userId, idea } = job;
    const log = createLogger('validate.worker');

    try {
      log.info('Starting validation', { runId, idea: idea.substring(0, 50) });
      blueprintService.updateRunStatus(runId, 'researching');

      // Run the Mastra workflow (steps 1 + 2 only, confirmBuild: false)
      const workflow = mastra.getWorkflow('validationWorkflow');
      const run = await workflow.createRun();
      const output = await run.start({
        inputData: { idea, confirmBuild: false }
      });

      if (output.status === 'failed') throw new Error(output.error?.message);

      const strategy = (output as any).result?.strategy;

      // Save to DB
      blueprintService.saveStrategy(runId, strategy);

      // Publish result back to Express SSE handler
      await redisService.publishResult(runId, {
        type: 'strategy_ready',
        runId,
        data: { strategy }
      });

      log.info('Validation complete', { runId });

    } catch (err: any) {
      log.error('Validation failed', { runId, error: err.message });
      blueprintService.updateRunStatus(runId, 'failed');
      await redisService.publishResult(runId, {
        type: 'error', runId, error: err.message
      });
    }
  });
}
```

---

### FILE 22: `src/workers/blueprint.worker.ts`

**What it does:** Subscribes to blueprint jobs. Runs `archAgent` with structured output. Publishes result.

**Build prompt:**
```
Create src/workers/blueprint.worker.ts:

Similar structure to validate.worker.ts but:
1. Subscribes to CHANNELS.BLUEPRINT_JOB
2. Gets the archAgent: mastra.getAgent('archAgent')
3. Streams the agent response and publishes chunks:
   const output = await agent.stream(prompt, { structuredOutput: { schema: ArchitectureSchema } })
   for await (const chunk of output.textStream) {
     await redisService.publishChunk(runId, chunk);
   }
   const result = await output.getFullOutput();
4. Saves blueprint to DB via blueprintService.saveBlueprint()
5. Publishes final result event with the complete blueprint object
```

---

### FILE 23: `src/workers/chat.worker.ts`

**What it does:** Subscribes to chat jobs. Streams consultant agent response back via Redis chunks.

**Build prompt:**
```
Create src/workers/chat.worker.ts:

Similar to blueprint.worker.ts but:
1. Subscribes to CHANNELS.CHAT_JOB
2. Gets consultantAgent: mastra.getAgent('consultantAgent')
3. Streams with memory:
   const output = await agent.stream(message, {
     memory: { thread: threadId, resource: userId }
   })
   for await (const chunk of output.textStream) {
     await redisService.publishChunk(jobId, chunk);
   }
4. On done, publishes { type: 'chat_done', runId: jobId }
5. Note: uses jobId (not runId) as the channel key for chat
```

---

### FILE 24: `src/workers/index.ts`

**What it does:** Worker entry point. Starts all workers in one process.

**Build prompt:**
```
Create src/workers/index.ts:

import and start all three workers:

async function main() {
  logger.info('🤖 Spark Worker starting...');
  await Promise.all([
    startValidateWorker(),
    startBlueprintWorker(),
    startChatWorker(),
  ]);
  logger.info('✅ All workers listening on Redis channels');
}

main().catch((err) => {
  logger.error('Worker crashed', err);
  process.exit(1);
});

Handle graceful shutdown:
process.on('SIGTERM', () => {
  logger.info('Worker shutting down...');
  // close Redis connections
  process.exit(0);
});
```

---

## PHASE 7 — Controllers

---

### FILE 25: `src/controllers/spark.controller.ts`

**What it does:** Handles the validate and blueprint HTTP requests. Publishes to Redis. Streams results back as SSE.

**Build prompt:**
```
Create src/controllers/spark.controller.ts with TWO controller functions:

// CONTROLLER 1: POST /api/spark/validate
export const validateIdea: RequestHandler = async (req, res, next) => {
  try {
    const { idea } = req.body as ValidateIdeaRequest;
    const userId = req.userId!;

    // 1. Initiate the job (creates DB record, publishes to Redis)
    const runId = await sparkService.initiateValidation(userId, idea);

    // 2. Immediately return the runId — client will SSE on /events/:runId
    res.status(202).json({ success: true, data: { runId } });
  } catch (err) { next(err); }
};

// CONTROLLER 2: POST /api/spark/blueprint
export const generateBlueprint: RequestHandler = async (req, res, next) => {
  try {
    const { runId } = req.body as GenerateBlueprintRequest;
    const userId = req.userId!;

    await sparkService.initiateBlueprintGeneration(runId, userId);

    res.status(202).json({ success: true, data: { runId } });
  } catch (err) { next(err); }
};

// CONTROLLER 3: GET /api/spark/events/:runId  (SSE)
export const streamEvents: RequestHandler = async (req, res, next) => {
  const { runId } = req.params;

  initSSE(res);  // set headers

  // Subscribe to Redis for this runId
  const unsubscribe = await redisService.subscribeToResult(
    runId,
    (chunk) => sendSSEEvent(res, 'chunk', { chunk }),
    (event) => {
      sendSSEEvent(res, event.type, event.data ?? event);
      if (event.type === 'strategy_ready' || event.type === 'blueprint_ready' || event.type === 'error') {
        unsubscribe();
        res.end();
      }
    },
    (err) => { sendSSEError(res, err.message); unsubscribe(); }
  );

  // Client disconnects → cleanup
  req.on('close', () => unsubscribe());
};
```

---

### FILE 26: `src/controllers/chat.controller.ts`

**What it does:** Handles chat requests. Creates threads, streams consultant responses via SSE.

**Build prompt:**
```
Create src/controllers/chat.controller.ts:

// POST /api/chat/thread — create a new thread
export const createThread: RequestHandler = (req, res, next) => {
  try {
    const { runId } = req.body;
    const result = chatService.createThread(req.userId!, runId);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/chat/message — send a message
export const sendMessage: RequestHandler = async (req, res, next) => {
  try {
    const { message, threadId, runId } = req.body as ChatRequest;
    const jobId = await chatService.initiateChat(req.userId!, threadId, message, runId);
    res.status(202).json({ success: true, data: { jobId } });
  } catch (err) { next(err); }
};

// GET /api/chat/events/:jobId — SSE for chat response
export const streamChatEvents: RequestHandler = async (req, res) => {
  const { jobId } = req.params;

  initSSE(res);

  const unsubscribe = await redisService.subscribeToResult(
    jobId,
    (chunk) => sendSSEEvent(res, 'chunk', { chunk }),
    (event) => {
      if (event.type === 'chat_done' || event.type === 'error') {
        sendSSEEvent(res, event.type, event);
        unsubscribe();
        res.end();
      }
    },
    (err) => { sendSSEError(res, err.message); unsubscribe(); }
  );

  req.on('close', () => unsubscribe());
};
```

---

### FILE 27: `src/controllers/blueprint.controller.ts`

**What it does:** CRUD for blueprints — fetch, list, mark steps, delete.

**Build prompt:**
```
Create src/controllers/blueprint.controller.ts:

// GET /api/blueprint/:runId
export const getBlueprint: RequestHandler = (req, res, next) => {
  try {
    const run = blueprintService.getRun(req.params.runId);
    if (!run) throw new AppError(404, 'Blueprint not found');
    if (run.userId !== req.userId) throw new AppError(403, 'Forbidden');
    res.json({ success: true, data: run });
  } catch (err) { next(err); }
};

// GET /api/blueprint/history
export const getHistory: RequestHandler = (req, res, next) => {
  try {
    const runs = blueprintService.getRunsByUser(req.userId!);
    res.json({ success: true, data: runs });
  } catch (err) { next(err); }
};

// GET /api/blueprint/:runId/status
export const getStatus: RequestHandler = (req, res, next) => {
  try {
    const run = blueprintService.getRun(req.params.runId);
    if (!run) throw new AppError(404, 'Not found');
    res.json({ success: true, data: { status: run.status, runId: run.runId } });
  } catch (err) { next(err); }
};

// DELETE /api/blueprint/:runId
export const deleteBlueprint: RequestHandler = (req, res, next) => {
  try {
    const deleted = blueprintService.deleteRun(req.params.runId, req.userId!);
    if (!deleted) throw new AppError(404, 'Not found or not owned by you');
    res.json({ success: true });
  } catch (err) { next(err); }
};
```

---

## PHASE 8 — Routes

---

### FILE 28: `src/routes/spark.routes.ts`

**Build prompt:**
```
Create src/routes/spark.routes.ts:

const router = Router();

router.post(
  '/validate',
  authMiddleware,
  sparkLimiter,
  validate(z.object({ idea: z.string().min(10).max(500) })),
  validateIdea
);

router.post(
  '/blueprint',
  authMiddleware,
  sparkLimiter,
  validate(z.object({ runId: z.string() })),
  generateBlueprint
);

router.get('/events/:runId', authMiddleware, streamEvents);

export default router;
```

---

### FILE 29: `src/routes/chat.routes.ts`

**Build prompt:**
```
Create src/routes/chat.routes.ts:

router.post('/thread', authMiddleware, createThread);

router.post(
  '/message',
  authMiddleware,
  chatLimiter,
  validate(z.object({
    message: z.string().min(1).max(2000),
    threadId: z.string(),
    runId: z.string().optional()
  })),
  sendMessage
);

router.get('/events/:jobId', authMiddleware, streamChatEvents);

router.get('/threads', authMiddleware, getThreadsByUser);
```

---

### FILE 30: `src/routes/blueprint.routes.ts`

**Build prompt:**
```
Create src/routes/blueprint.routes.ts:

router.get('/history', authMiddleware, getHistory);
router.get('/:runId', authMiddleware, getBlueprint);
router.get('/:runId/status', authMiddleware, getStatus);
router.delete('/:runId', authMiddleware, deleteBlueprint);
```

---

### FILE 31: `src/routes/index.ts`

**Build prompt:**
```
Create src/routes/index.ts that mounts all routers:

app.use('/api/spark', sparkRouter);
app.use('/api/chat', chatRouter);
app.use('/api/blueprint', blueprintRouter);

// Health check (no auth)
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
```

---

## PHASE 9 — App & Server Entry Points

---

### FILE 32: `src/app.ts`

**Build prompt:**
```
Create src/app.ts that:
1. Creates Express app
2. Applies middleware in order:
   - helmet() (security headers)
   - cors({ origin: env.ALLOWED_ORIGINS.split(',') })
   - compression()
   - express.json({ limit: '10kb' })
   - apiLimiter (global rate limit)
3. Mounts all routes from routes/index.ts
4. Applies errorHandler as last middleware
5. Exports the app (not listening — that's server.ts)
```

---

### FILE 33: `src/server.ts`

**Build prompt:**
```
Create src/server.ts:
1. Imports app from app.ts
2. Tests DB connection (runs db.pragma('integrity_check'))
3. Tests Redis connection (publisher.ping())
4. Starts HTTP server on env.PORT
5. Logs startup: "🚀 Spark API running on port X"
6. On uncaughtException / unhandledRejection: log + exit(1)
```

---

## Build Order Summary

| Phase | Files | Start here because... |
|---|---|---|
| **1 — Scaffold** | package.json, tsconfig.json, .env.example | Installs dependencies |
| **2 — Config** | env.ts, redis.ts, db.ts | Everything imports these |
| **3 — Types** | redis.types.ts, api.types.ts, spark.types.ts | Used by services + controllers |
| **4 — Utils/MW** | logger.ts, sse.ts, id.ts, auth.ts, validate.ts, errorHandler.ts, rateLimiter.ts | Used by everything |
| **5 — Services** | redis.service.ts, blueprint.service.ts, spark.service.ts, chat.service.ts | Business logic |
| **6 — Workers** | validate.worker.ts, blueprint.worker.ts, chat.worker.ts, workers/index.ts | The Mastra bridge |
| **7 — Controllers** | spark.controller.ts, chat.controller.ts, blueprint.controller.ts | HTTP handlers |
| **8 — Routes** | spark.routes.ts, chat.routes.ts, blueprint.routes.ts, routes/index.ts | Wires controllers |
| **9 — Entry** | app.ts, server.ts | Starts the server |

---

## How to Run

```bash
# Terminal 1 — Redis (if local)
docker run -p 6379:6379 redis:alpine

# Terminal 2 — Worker (Mastra bridge)
npm run dev:worker

# Terminal 3 — API server
npm run dev
```

**Test it:**
```bash
# 1. Start validation (returns runId immediately)
curl -X POST http://localhost:3001/api/spark/validate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"idea": "AI agency for 2027"}'
# → { "success": true, "data": { "runId": "run_abc123" } }

# 2. Listen for results (SSE)
curl -N http://localhost:3001/api/spark/events/run_abc123 \
  -H "Authorization: Bearer <token>"
# → event: chunk\ndata: {"chunk": "..."}\n\n   (streams in real-time)
# → event: strategy_ready\ndata: {"strategy": {...}}\n\n

# 3. Generate blueprint
curl -X POST http://localhost:3001/api/spark/blueprint \
  -H "Authorization: Bearer <token>" \
  -d '{"runId": "run_abc123"}'
```
