import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';
import { weatherWorkflow } from './workflows/weather-workflow.js';
import { validationWorkflow } from './workflows/validationWorkflow.js';
import { weatherAgent } from './agents/weather-agent.js';
import { researchAgent } from './agents/researchagent.js';
import { pmAgent } from './agents/pmAgent.js';
import { consultantAgent } from './agents/consultantAgent.js';
import { archAgent } from './agents/arcagent.js';
import { sparkMCPServer } from './mcp/sparkMCPServer.js';

import { toolCallAppropriatenessScorer, completenessScorer, translationScorer } from './scorers/weather-scorer.js';

const databaseUrl = process.env.TURSO_DATABASE_URL || "file:./mastra.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const mastra = new Mastra({
  workflows: { weatherWorkflow, validationWorkflow },
  agents: { weatherAgent, researchAgent, pmAgent, consultantAgent, archAgent },
  mcpServers: { sparkMCPServer },

  scorers: { toolCallAppropriatenessScorer, completenessScorer, translationScorer },
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: databaseUrl,
    authToken: authToken,
  }),
  memory: {
    default: new Memory({
      storage: new LibSQLStore({
        id: "mastra-memory",
        url: databaseUrl,
        authToken: authToken,
      }),
    }),
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),

  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new DefaultExporter(), // Persists traces to storage for Mastra Studio
          new CloudExporter(), // Sends traces to Mastra Cloud (if MASTRA_CLOUD_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
