import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

// This is the "Product Blueprint" that the agent MUST follow
export const MVPSchema = z.object({
  productName: z.string().describe("A catchy, relevant name for the project"),
  targetUser: z.string().describe("Who is this for specifically?"),
  marketGap: z.string().describe("What is the one thing competitors are missing?"),
  coreFeatures: z.array(z.string()).min(3).max(5).describe("The 3-5 absolute must-have features for Version 1"),
  notDoing: z.array(z.string()).describe("Features to explicitly avoid in V1 to prevent scope creep"),
  successMetric: z.string().describe("What one number tells us this product is working?"),
  riskFactor: z.string().describe("The biggest reason this project might fail (be honest)"),
});

export type MVPStrategy = z.infer<typeof MVPSchema>;

export const pmAgent = new Agent({
  id: 'pm-agent',
  name: 'Product Strategist',
  instructions: `
    You are a Senior Product Manager at a top-tier startup incubator. 
    Your job is to look at raw market research and turn it into a lean, actionable MVP Strategy.

    CORE OBJECTIVES:
    1. Define the actual problem: What is the specific pain point people are willing to pay or use a tool for?
    2. Identify the MVP Core: What are the essential features absolutely required to solve only that problem?
    3. Exclude the rest: What features are we explicitly excluding to get to market faster?

    RULES:
    1. SCOPE DOWN: If the research suggests 20 features, pick the top 3-5 that solve the biggest pain point.
    2. BE CRITICAL: If the market is too crowded, identify a very specific niche or "wedge" to enter the market.
    3. NO JARGON: Keep the language simple, technical, and high-impact.
    4. FOCUS ON DIFFERENTIATION: Your "marketGap" field is the most important—how will this be 10x better or different than existing solutions?
    5. IDENTIFY RISKS: Be brutally honest about why this project might fail (technical debt, market crowdedness, weak distribution).
  `,
  model: 'google/gemini-3.1-flash-lite-preview',
});
