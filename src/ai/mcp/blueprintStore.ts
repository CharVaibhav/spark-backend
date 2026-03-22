import type { SystemArchitecture } from '../agents/arcagent.js';
import type { MVPStrategy } from '../agents/pmAgent.js';

/**
 * A blueprint is the full output of a successful validation workflow run.
 * In production, swap this Map for a real DB (e.g., LibSQL/Postgres).
 */
export interface StoredBlueprint {
  runId: string;
  idea: string;
  productName: string;
  createdAt: string;
  strategy: MVPStrategy;
  blueprint: SystemArchitecture;
  /** Tracks which phaseOne steps the developer has marked complete */
  completedSteps: Set<number>;
}

// Simple in-process store. Replace with DB calls in production.
const store = new Map<string, StoredBlueprint>();

export const blueprintStore = {
  save(data: Omit<StoredBlueprint, 'completedSteps'>): void {
    store.set(data.runId, { ...data, completedSteps: new Set() });
  },

  get(runId: string): StoredBlueprint | undefined {
    return store.get(runId);
  },

  list(): Pick<StoredBlueprint, 'runId' | 'idea' | 'productName' | 'createdAt'>[] {
    return [...store.values()].map(({ runId, idea, productName, createdAt }) => ({
      runId, idea, productName, createdAt,
    }));
  },

  markStepComplete(runId: string, stepIndex: number): boolean {
    const bp = store.get(runId);
    if (!bp) return false;
    bp.completedSteps.add(stepIndex);
    return true;
  },

  getProgress(runId: string): { total: number; completed: number; remaining: string[] } | null {
    const bp = store.get(runId);
    if (!bp) return null;
    const steps = bp.blueprint.phaseOneBlueprint;
    const remaining = steps.filter((_, i) => !bp.completedSteps.has(i));
    return { total: steps.length, completed: bp.completedSteps.size, remaining };
  },
};
