import { MCPServer } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import type { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { blueprintStore } from './blueprintStore.js';

// Lazy import to break circular dependency (sparkMCPServer ↔ mastra/index)
async function getArch(): Promise<Agent> {
  const { mastra } = await import('../index.js');
  const agent = mastra.getAgent('archAgent');
  if (!agent) throw new Error('archAgent not found in Mastra instance');
  return agent as Agent;
}


// ─────────────────────────────────────────────
// TOOL 1 — List all blueprints in the store
// ─────────────────────────────────────────────
const list_blueprints = createTool({
  id: 'list_blueprints',
  description: 'Lists all product blueprints stored in Spark. Use this to find a runId.',
  inputSchema: z.object({}),
  outputSchema: z.array(z.object({
    runId: z.string(),
    productName: z.string(),
    idea: z.string(),
    createdAt: z.string(),
  })),
  execute: async () => blueprintStore.list(),
});

// ─────────────────────────────────────────────
// TOOL 2 — Get the full blueprint for a run
// ─────────────────────────────────────────────
const get_blueprint = createTool({
  id: 'get_blueprint',
  description: `
    Retrieves the full Spark blueprint for a given project runId.
    Returns the MVP strategy, technical architecture, phase-one checklist,
    system diagram, and identified technical risks.
    Always call this first when the developer asks about their project.
  `,
  inputSchema: z.object({
    runId: z.string().describe('The unique run ID for the Spark session'),
  }),
  outputSchema: z.object({
    productName: z.string(),
    idea: z.string(),
    strategy: z.any(),
    blueprint: z.any(),
  }),
  execute: async ({ runId }) => {
    const stored = blueprintStore.get(runId);
    if (!stored) {
      throw new Error(`No blueprint found for runId "${runId}". Use list_blueprints first.`);
    }
    return {
      productName: stored.productName,
      idea: stored.idea,
      strategy: stored.strategy,
      blueprint: stored.blueprint,
    };
  },
});

// ─────────────────────────────────────────────
// TOOL 3 — Get current build progress
// ─────────────────────────────────────────────
const get_progress = createTool({
  id: 'get_progress',
  description: `
    Returns the developer's current build progress:
    how many phase-one steps are complete, and which ones remain.
    Use this to understand what the developer should focus on next.
  `,
  inputSchema: z.object({
    runId: z.string(),
  }),
  outputSchema: z.object({
    total: z.number(),
    completed: z.number(),
    remaining: z.array(z.string()),
  }),
  execute: async ({ runId }) => {
    const progress = blueprintStore.getProgress(runId);
    if (!progress) throw new Error(`No blueprint found for runId "${runId}"`);
    return progress;
  },
});

// ─────────────────────────────────────────────
// TOOL 4 — Mark a phase-one step complete
// ─────────────────────────────────────────────
const mark_step_complete = createTool({
  id: 'mark_step_complete',
  description: `
    Marks a specific phase-one blueprint step as completed by the developer.
    Steps are 0-indexed (step 0 = the first item in the phase-one blueprint list).
    Call this when the developer confirms they've finished a step.
  `,
  inputSchema: z.object({
    runId: z.string(),
    stepIndex: z.number().int().min(0).describe('0-based index of the completed step'),
  }),
  outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  execute: async ({ runId, stepIndex }) => {
    const ok = blueprintStore.markStepComplete(runId, stepIndex);
    return {
      success: ok,
      message: ok
        ? `✅ Step ${stepIndex + 1} marked as complete!`
        : `❌ Could not find blueprint for runId: ${runId}`,
    };
  },
});

// ─────────────────────────────────────────────
// TOOL 5 — Ask the Architect a technical question
// ─────────────────────────────────────────────
const ask_architect = createTool({
  id: 'ask_architect',
  description: `
    Ask the Spark AI Architect agent a specific technical question about your blueprint.
    Use this for: "What library should I use for X?", "How do I implement Y?",
    "What's the correct folder structure?", or "How should I handle Z?".
    Providing filesInProject gives the architect awareness of what you've already built.
  `,
  inputSchema: z.object({
    runId: z.string(),
    question: z.string().describe('Your technical question about the project'),
    filesInProject: z.array(z.string()).optional().describe(
      'File/folder list from your project root (paste output of: ls -R or tree /F)'
    ),
  }),
  outputSchema: z.object({ answer: z.string() }),
  execute: async ({ runId, question, filesInProject }) => {
    const stored = blueprintStore.get(runId);
    if (!stored) throw new Error(`No blueprint found for runId "${runId}"`);

    const agent = await getArch();
    const filesCtx = filesInProject?.length
      ? `\n\nFiles already in the project:\n${filesInProject.join('\n')}`
      : '';

    const prompt = `
You are advising the developer building: "${stored.productName}"

Blueprint Context:
${JSON.stringify({ strategy: stored.strategy, blueprint: stored.blueprint }, null, 2)}
${filesCtx}

Developer's question: "${question}"

Give a focused, actionable answer. Reference the blueprint where relevant. Be concrete — name files, commands, and code snippets.
    `.trim();

    const result = await agent.generate(prompt);
    return { answer: result.text };
  },
});

// ─────────────────────────────────────────────
// TOOL 6 — Get context-aware next step
// ─────────────────────────────────────────────
const get_next_step = createTool({
  id: 'get_next_step',
  description: `
    Determines the single most important thing the developer should build next.
    Takes into account which blueprint steps are already completed and what
    files currently exist in the project. Returns a specific, actionable task
    with example code or terminal commands.
  `,
  inputSchema: z.object({
    runId: z.string(),
    filesInProject: z.array(z.string()).optional().describe(
      'Output of "ls -R" or "tree /F" from your project root — helps the AI see what is already built'
    ),
  }),
  outputSchema: z.object({ nextStep: z.string() }),
  execute: async ({ runId, filesInProject }) => {
    const stored = blueprintStore.get(runId);
    if (!stored) throw new Error(`No blueprint found for runId "${runId}"`);

    const progress = blueprintStore.getProgress(runId)!;
    const agent = await getArch();

    const filesCtx = filesInProject?.length
      ? `Files already in the project:\n${filesInProject.join('\n')}`
      : 'No file list provided — advise based on the blueprint steps alone.';

    const prompt = `
You are a senior engineer mentoring the developer building: "${stored.productName}"

Phase-one blueprint (full list):
${stored.blueprint.phaseOneBlueprint.map((s: string, i: number) => `  Step ${i + 1}: ${s}`).join('\n')}

Progress: ${progress.completed} of ${progress.total} steps done.
Remaining:
${progress.remaining.map((s: string, i: number) => `  ${i + 1}. ${s}`).join('\n')}

${filesCtx}

What is the ONE thing the developer should do right now? Be ruthlessly specific:
name the exact file to create, command to run, or function to write.
Add a short code snippet or terminal command if applicable.
    `.trim();

    const result = await agent.generate(prompt);
    return { nextStep: result.text };
  },
});

// ─────────────────────────────────────────────
// THE MCP SERVER
// ─────────────────────────────────────────────
export const sparkMCPServer = new MCPServer({
  id: 'spark-blueprint-guide',
  name: '✨ Spark Blueprint Guide',
  version: '1.0.0',
  tools: {
    list_blueprints,
    get_blueprint,
    get_progress,
    mark_step_complete,
    ask_architect,
    get_next_step,
  },
});
