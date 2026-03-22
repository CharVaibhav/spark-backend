import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

export const ArchitectureSchema = z.object({
  productType: z.enum(["PURE_SOFTWARE", "PURE_HARDWARE", "HYBRID_IOT"]).describe(
    "Categorize the physical and digital footprint of the product."
  ),

  // SOFTWARE SPECS (Filled if Software or Hybrid)
  softwareArchitecture: z.object({
    stack: z.string().describe("E.g., Next.js frontend, Node.js backend, PostgreSQL"),
    databaseSchema: z.array(z.string()).describe("Core tables and relationships"),
    apiStrategy: z.string().describe("REST, GraphQL, or gRPC endpoints needed"),
    cloudInfrastructure: z.string().describe("Deployment strategy (e.g., Docker, Kubernetes, Vercel)")
  }).optional(),

  // HARDWARE SPECS (Filled if Hardware or Hybrid)
  hardwareArchitecture: z.object({
    coreMicrocontroller: z.string().describe("The brain (e.g., ESP32, Raspberry Pi Compute Module, nRF52)"),
    billOfMaterials: z.array(z.string()).describe("Top 3-5 critical off-the-shelf components (sensors, batteries, optics)"),
    powerManagement: z.string().describe("Battery life strategy and power draw considerations"),
    prototypingPath: z.string().describe("How to build the V1 (e.g., Breadboard -> Custom PCB -> 3D printed enclosure)")
  }).optional(),

  // UNIVERSAL SPECS (Always Required)
  systemDiagram: z.string().describe(
    "A valid Mermaid.js string. If software, a system architecture flowchart. If hardware, a component wiring/block diagram."
  ),
  technicalRisks: z.array(z.string()).describe(
    "The biggest engineering bottlenecks (e.g., 'API rate limits' or 'Heat dissipation in a small form factor')."
  ),
  phaseOneBlueprint: z.array(z.string()).describe(
    "The exact, step-by-step developer/maker checklist for the first 7 days of the build."
  )
});

export type SystemArchitecture = z.infer<typeof ArchitectureSchema>;

export const archAgent = new Agent({
  id: 'architect-agent',
  name: 'Principal Systems Architect',
  instructions: `
    You are a Staff Principal Engineer who specializes in Hardware-Software Co-Design. 
    You take strategic business requirements and translate them into ruthless, pragmatic technical blueprints.

    YOUR ENGINEERING PHILOSOPHY:
    1. **For Software:** You favor scalable, modern stacks (e.g., Node.js/TypeScript backends, Docker, Kubernetes). You despise over-engineering. Pick the right database for the job.
    2. **For Hardware:** You do not invent new physics. For V1 prototypes, you rely strictly on Commercial Off-The-Shelf (COTS) components (ESP32, standard sensors, 3D printing) before suggesting custom silicon or expensive manufacturing runs.
    3. **For Hybrid (IoT):** You strictly separate "Edge Compute" (what happens on the device) from "Cloud Compute" (what happens on the server) to save battery and bandwidth.

    --- OUTPUT RULES ---
    1. Assess the product idea. Determine if it is PURE_SOFTWARE, PURE_HARDWARE, or HYBRID_IOT.
    2. Fill out the respective schema sections with high technical accuracy.
    3. Write a flawless Mermaid.js diagram. For hardware, use it to show how components wire together (MCU -> Sensor -> Battery). For software, show the data flow (Client -> API Gateway -> DB).
    4. Keep the "Phase One Blueprint" actionable. What should the developer literally type into their terminal or solder together today?
  `,
  model: 'google/gemini-3.1-flash-lite-preview',
});

