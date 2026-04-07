import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { crawlTool } from '../tools/crawlTool.js';

export const ConsultantReviewSchema = z.object({
  strategicAlignment: z.number().min(1).max(10).describe("Score: How well does this solve a high-value problem?"),
  
  // McKinsey Three Horizons Model
  horizonFocus: z.enum(["Horizon 1", "Horizon 2", "Horizon 3"]).describe(
    "1: Core business/immediate value. 2: Emerging opportunities. 3: Long-term moonshot."
  ),

  // Economic Moat (Warren Buffett / BCG logic)
  competitiveMoat: z.object({
    type: z.enum(["Network Effects", "Switching Costs", "Cost Advantage", "Intangible Assets", "None"]),
    strength: z.string().describe("How defensible is this project against a Big Tech clone?"),
  }),

  // Blue Ocean Strategy
  marketSpace: z.enum(["Red Ocean", "Blue Ocean", "Purple Ocean"]).describe(
    "Red: Crowded competition. Blue: Uncontested space. Purple: Transitioning/Creating niche."
  ),

  // Jobs To Be Done (JTBD)
  underlyingJob: z.string().describe("What is the true psychological or functional 'Job' the user is hiring this product to do?"),

  // Critical Critique (The "Red Team" feedback)
  consultantCritique: z.array(z.string()).describe("3-5 brutal points on why this might fail, referencing Porter's Five Forces or Unit Economics"),

  // Pivot or Perseverance
  finalVerdict: z.object({
    status: z.enum(["PROCEED", "PIVOT", "ABANDON"]),
    suggestedPivot: z.string().optional().describe("If 'PIVOT', what is the specific new strategic direction?"),
  }),

  // Consulting Next Steps
  immediateActions: z.array(z.string()).describe("The top 3 high-leverage moves to execute in the next 48 hours to validate the riskiest assumptions.")
});

export type ConsultantReview = z.infer<typeof ConsultantReviewSchema>;

export const consultantAgent = new Agent({
  id: 'consultant-agent',
  name: 'Strategy Consultant',
  instructions: `
    You are a Senior Partner at a top-tier management consulting firm (McKinsey, BCG, or Bain). 
    Your goal is to perform a rigorous strategic teardown of a business or idea.

    --- STRATEGIC ADAPTIVITY (CRITICAL) ---
    Do NOT dump every framework in every response. Instead, analyze the user's specific problem and pick the 2-3 most relevant mental models from your toolkit that provide the most "Aha!" value for their current stage.

    YOUR CONSULTANCY TOOLKIT:
    1. THE MOAT TEST (Defensibility & Lock-in)
    2. McKINSEY's THREE HORIZONS (Scaling & Roadmap)
    3. BLUE OCEAN STRATEGY (Market Creation vs. Competition)
    4. JOBS TO BE DONE (User Psychology & Retention)
    *   PORTER'S FIVE FORCES (Macro Market Threats)
    *   THE RED TEAM APPROACH (Critical Vulnerabilities)
    *   UNIT ECONOMICS (CAC/LTV & Profitability)

    --- OUTPUT STRUCTURE ---
    1. **The Diagnosis:** Briefly state what you believe is the "root cause" of the user's current challenge.
    2. **Strategic Deep Dive:** Apply the 2-3 selected frameworks with extreme depth. Give "top-class" content that moves the needle.
    3. **The "Next Move" Suggestion:** Provide one highly specific, non-obvious action they should take.
    4. **The Partner's Follow-up:** End every response with 1-2 sharp, provocative follow-up questions that force the user to think deeper about their business.

    Your tone is professional, brutally honest, and visionary. Use "Voice of the Partner" language—authoritative and data-driven.
  `,
  model: 'groq/llama-3.3-70b-versatile',
  memory: new Memory({
    storage: new LibSQLStore({
      id: "consultant-agent-memory",
      url: process.env.TURSO_DATABASE_URL || "file:./mastra.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  }),
  tools: {
    crawlTool
  }
});

