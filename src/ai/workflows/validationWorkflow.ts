import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { MVPSchema } from '../agents/pmAgent.js';
import { ArchitectureSchema } from '../agents/arcagent.js';

// Step 1 Output
const ResearchResultSchema = z.object({
  researchDump: z.string(),
  confirmBuild: z.boolean().default(false),
});

// Step 2 Output
const StrategyResultSchema = z.object({
  researchDump: z.string(),
  strategy: MVPSchema,
  confirmBuild: z.boolean().default(false),
});

// Step 3 Output
const ArchitectureResultSchema = z.object({
  strategy: MVPSchema,
  blueprint: ArchitectureSchema.optional(),
  status: z.string(),
});

// 1. Define Step 1: Research
const researchStep = createStep({
  id: 'research-step',
  description: 'Gathers raw market research data for a given product idea',
  inputSchema: z.object({
    idea: z.string().describe('The product spark idea to validate'),
    confirmBuild: z.boolean().default(false),
  }),
  outputSchema: ResearchResultSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('Input data not found');

    const agent = mastra?.getAgent('researchAgent');
    if (!agent) throw new Error('Research agent not found in Mastra instance');

    console.log(`[ResearchStep] Starting research for idea: "${inputData.idea}"`);

    const result = await agent.generate([
      { role: 'user', content: `Please validate this product idea and provide the necessary competitor and market analysis: ${inputData.idea}` }
    ]);

    console.log(`[ResearchStep] Research complete. Passing data dump to strategy...`);

    return {
      researchDump: result.text,
      confirmBuild: inputData.confirmBuild,
    };
  },
});

// 2. Define Step 2: PM Strategy
const strategyStep = createStep({
  id: 'strategy-step',
  description: 'Distills market research into a structured MVP strategy',
  inputSchema: ResearchResultSchema,
  outputSchema: StrategyResultSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('Input data not found');

    const agent = mastra?.getAgent('pmAgent');
    if (!agent) throw new Error('PM agent not found in Mastra instance');

    console.log(`[StrategyStep] Digesting research and computing MVP strategy...`);

    const result = await agent.generate(
      `Here is the raw market data. Distill it into our strict MVP strategy format: \n\n${inputData.researchDump}`,
      {
        structuredOutput: {
          schema: MVPSchema,
          logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
        },
      }
    );

    console.log(`[StrategyStep] Validation Strategy completely processed!`);

    return {
      researchDump: inputData.researchDump,
      strategy: result.object,
      confirmBuild: inputData.confirmBuild,
    };
  },
});

// 3. Define Step 3: Architecture Blueprint (Conditional)
const architectureStep = createStep({
  id: 'architecture-step',
  description: 'Generates a full-stack hardware/software architecture blueprint',
  inputSchema: StrategyResultSchema,
  outputSchema: ArchitectureResultSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('Input data not found');

    // Skip if user hasn't confirmed
    if (!inputData.confirmBuild) {
      console.log(`[ArchitectureStep] Build not confirmed. Skipping technical blueprint.`);
      return {
        strategy: inputData.strategy,
        status: 'SKIPPED_USER_APPROVAL_PENDING',
      };
    }

    const agent = mastra?.getAgent('archAgent');
    if (!agent) throw new Error('Architect agent not found in Mastra instance');

    console.log(`[ArchitectureStep] Engineering the blueprint for "${inputData.strategy.productName}"...`);

    const result = await agent.generate(
      `Context:
      Research Dump: ${inputData.researchDump}
      MVP Strategy: ${JSON.stringify(inputData.strategy, null, 2)}
      
      Generate a ruthless technical blueprint based on this research and strategy.`,
      {
        structuredOutput: {
          schema: ArchitectureSchema,
          logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as any,
        },
      }
    );

    console.log(`[ArchitectureStep] Blueprint generation complete.`);

    return {
      strategy: inputData.strategy,
      blueprint: result.object,
      status: 'SUCCESS',
    };
  },
});

// 4. Chain them together into the exported workflow
export const validationWorkflow = createWorkflow({
  id: 'validation-workflow',
  inputSchema: z.object({ 
    idea: z.string(),
    confirmBuild: z.boolean().describe('Set to true to trigger the Architect Agent for technical blueprints').default(false)
  }),
  outputSchema: ArchitectureResultSchema,
})
  .then(researchStep)
  .then(strategyStep)
  .then(architectureStep);

validationWorkflow.commit();
