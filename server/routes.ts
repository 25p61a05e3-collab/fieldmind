import { Router } from "express";
import { z } from "zod";
import type {
  DemoScenario,
  DemoSession,
  IncidentInput,
  IncidentRecord,
  ResolutionInput,
} from "@shared/types";
import {
  analyzeIncident,
  agentProviderStatus,
  extractLearning,
  retainIncidentLearning,
} from "./services/agent";
import {
  hindsightProviderStatus,
  recallRecent,
  retainBatch,
} from "./services/hindsight";
import {
  checkMongo,
  countIncidents,
  createDemoSession,
  equipmentCatalogSnapshot,
  getDemoSession,
  getEquipment,
  getIncident,
  getResolutionForIncident,
  insertIncident,
  insertResolution,
  listEquipmentHistory,
  listRecentResolutions,
  mongoProviderStatus,
  updateDemoSession,
  updateIncident,
} from "./services/mongo";
import type { MemoryStatus } from "@shared/types";

const incidentSchema = z.object({
  equipmentId: z.string().trim().min(2).max(32),
  equipmentType: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(120),
  reportedIssue: z.string().trim().min(8).max(500),
  symptoms: z.string().trim().min(8).max(1000),
  severity: z.enum(["low", "medium", "high", "critical"]),
  operatingContext: z.string().trim().min(8).max(1000),
  demoSessionId: z.string().trim().min(8).max(80).optional(),
});

const resolutionSchema = z.object({
  rootCause: z.string().trim().min(3).max(500),
  actionsTaken: z.string().trim().min(5).max(1000),
  result: z.enum(["resolved", "partially_resolved", "failed"]),
  resolved: z.boolean(),
  technicianFeedback: z.string().trim().min(3).max(1000),
  notes: z.string().trim().max(1200),
});

const demoAdvanceSchema = z.object({
  sessionId: z.string().trim().min(8).max(80),
  targetStep: z.union([z.literal(5), z.literal(10), z.literal(20)]),
});

const demoScenarios: DemoScenario[] = [
  {
    step: 1,
    label: "Interaction 1 · First pass",
    helper:
      "Generic starting point before this session has retained experience.",
    incident: {
      equipmentId: "P-204",
      equipmentType: "Centrifugal pump",
      location: "North process bay",
      reportedIssue:
        "Pump P-204 is vibrating heavily and shutting down after running for about 10 minutes.",
      symptoms:
        "High vibration at the drive end, audible rattling, and automatic shutdown after approximately ten minutes under normal production load.",
      severity: "high",
      operatingContext:
        "Issue began during a normal batch after the pump returned from routine maintenance.",
    },
  },
  {
    step: 5,
    label: "Interaction 5 · Relevant recall",
    helper: "The same fault now has a retained resolution to compare against.",
    incident: {
      equipmentId: "P-204",
      equipmentType: "Centrifugal pump",
      location: "North process bay",
      reportedIssue:
        "P-204 is vibrating again and trips after roughly 10 minutes of operation.",
      symptoms:
        "Drive-end vibration returns after maintenance; the coupling guard sounds slightly loose and the trip follows a warm-up period.",
      severity: "high",
      operatingContext:
        "Post-maintenance restart during a standard production run.",
    },
  },
  {
    step: 10,
    label: "Interaction 10 · Cross-equipment pattern",
    helper:
      "Similar post-maintenance experience from P-207 expands the pattern.",
    incident: {
      equipmentId: "P-204",
      equipmentType: "Centrifugal pump",
      location: "North process bay",
      reportedIssue:
        "P-204 shows recurring vibration and an unexpected shutdown after maintenance.",
      symptoms:
        "Vibration increases during warm-up; a similar symptom was reported on another pump in the same bay after coupling work.",
      severity: "high",
      operatingContext:
        "The pump was returned to service after maintenance and is carrying a normal process load.",
    },
  },
  {
    step: 20,
    label: "Interaction 20 · Experienced response",
    helper:
      "Accumulated outcomes should prioritize coupling/alignment before replacement.",
    incident: {
      equipmentId: "P-204",
      equipmentType: "Centrifugal pump",
      location: "North process bay",
      reportedIssue:
        "P-204 is vibrating heavily again after maintenance and shuts down after approximately 10 minutes.",
      symptoms:
        "The repeated warm-up vibration matches prior coupling events; mounting torque and alignment have not yet been rechecked on this visit.",
      severity: "high",
      operatingContext:
        "Post-maintenance restart on the same process line with no change in product or load.",
    },
  },
];

const demoSeeds: Record<
  5 | 10 | 20,
  Array<{
    content: string;
    document_id: string;
    context: string;
    timestamp: string;
    metadata: Record<string, string>;
    tags: string[];
  }>
> = {
  5: [
    {
      content:
        "P-207 developed vibration after maintenance. Coupling misalignment was confirmed; the coupling was realigned and the pump returned to normal operation. Technician noted that alignment should be checked before replacing bearings.",
      document_id: "fieldmind-demo-p207-alignment",
      context: "field-service resolution",
      timestamp: "2026-08-12T09:00:00Z",
      metadata: {
        equipmentId: "P-207",
        result: "resolved",
        source: "fieldmind-demo",
      },
      tags: [],
    },
    {
      content:
        "P-204 had excessive vibration and an automatic shutdown. A loose coupling was found, tightened, and verified under load. The machine operated normally after the repair.",
      document_id: "fieldmind-demo-p204-loose-coupling",
      context: "field-service resolution",
      timestamp: "2026-08-20T09:00:00Z",
      metadata: {
        equipmentId: "P-204",
        result: "resolved",
        source: "fieldmind-demo",
      },
      tags: [],
    },
  ],
  10: [
    {
      content:
        "A second P-204 vibration investigation found coupling alignment out of tolerance after maintenance. Realignment resolved the shutdown. An initial bearing replacement was not needed.",
      document_id: "fieldmind-demo-p204-repeat-alignment",
      context: "field-service resolution",
      timestamp: "2026-08-28T09:00:00Z",
      metadata: {
        equipmentId: "P-204",
        result: "resolved",
        source: "fieldmind-demo",
      },
      tags: [],
    },
    {
      content:
        "On P-207, checking mounting torque and coupling alignment before changing components resolved a post-maintenance vibration. A visual-only inspection was insufficient.",
      document_id: "fieldmind-demo-p207-mounting-torque",
      context: "field-service resolution",
      timestamp: "2026-09-03T09:00:00Z",
      metadata: {
        equipmentId: "P-207",
        result: "resolved",
        source: "fieldmind-demo",
      },
      tags: [],
    },
  ],
  20: [
    {
      content:
        "Repeated vibration on P-204 and P-207 after maintenance was more often associated with coupling alignment or mounting torque than with immediate component failure. Vibration measurement after mechanical checks was the reliable verification step.",
      document_id: "fieldmind-demo-pump-pattern",
      context: "field-service observation",
      timestamp: "2026-09-10T09:00:00Z",
      metadata: {
        equipmentId: "P-204/P-207",
        result: "pattern",
        source: "fieldmind-demo",
      },
      tags: [],
    },
    {
      content:
        "A failed first attempt on P-204 was replacing a bearing before checking coupling alignment. The bearing replacement did not remove the vibration; alignment correction was the successful next action.",
      document_id: "fieldmind-demo-p204-failed-first-attempt",
      context: "field-service resolution",
      timestamp: "2026-09-15T09:00:00Z",
      metadata: {
        equipmentId: "P-204",
        result: "partially_resolved",
        source: "fieldmind-demo",
      },
      tags: [],
    },
    {
      content:
        "Technicians should record whether vibration appears during warm-up, verify coupling alignment and mounting torque, and then measure vibration before authorizing component replacement on recurring pump incidents.",
      document_id: "fieldmind-demo-pump-technician-note",
      context: "technician feedback",
      timestamp: "2026-09-20T09:00:00Z",
      metadata: {
        equipmentId: "P-204/P-207",
        result: "guidance",
        source: "fieldmind-demo",
      },
      tags: [],
    },
  ],
};

function jsonError(
  res: Parameters<Router["use"]>[1] extends never ? never : any,
  status: number,
  message: string,
  details?: unknown
) {
  return res.status(status).json({ error: message, details });
}

function toIncidentRecord(
  input: IncidentInput,
  interactionNumber: number
): IncidentRecord {
  return {
    ...input,
    id: crypto.randomUUID(),
    status: "analyzing",
    createdAt: new Date().toISOString(),
    interactionNumber,
  };
}

function toResolutionLearningStatus(status: MemoryStatus): MemoryStatus {
  return status;
}

export const apiRouter = Router();

apiRouter.get("/health", async (_req, res) => {
  const mongo = await checkMongo();
  const provider = agentProviderStatus();
  res.json({
    status: "ok",
    serviceStatus: {
      mongo,
      hindsight: provider.hindsight,
      groq: provider.groq,
    },
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get("/demo/status", async (req, res) => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
  const session = sessionId ? await getDemoSession(sessionId) : undefined;
  res.json({
    serviceStatus: {
      mongo: mongoProviderStatus(),
      hindsight: hindsightProviderStatus(),
      groq: agentProviderStatus().groq,
    },
    session,
    recentRetainedCount: (await listRecentResolutions(50)).filter(
      item => item.retainStatus === "connected"
    ).length,
  });
});

apiRouter.post("/demo/start", async (_req, res) => {
  const session: DemoSession = {
    id: crypto.randomUUID(),
    interactionCount: 0,
    completedSteps: [],
    memoryStatus:
      hindsightProviderStatus() === "connected"
        ? "empty"
        : hindsightProviderStatus(),
    scenarios: demoScenarios.map(scenario => ({
      ...scenario,
      incident: { ...scenario.incident, demoSessionId: undefined },
    })),
    createdAt: new Date().toISOString(),
  };
  await createDemoSession(session);
  res.json({
    session,
    sourceNote:
      "Demo Mode uses the same incident, recall, reasoning, resolution, and retain routes. It starts with an empty Hindsight tag scope.",
  });
});

apiRouter.post("/demo/advance", async (req, res) => {
  const parsed = demoAdvanceSchema.safeParse(req.body);
  if (!parsed.success)
    return jsonError(
      res,
      400,
      "Invalid demo progression request",
      parsed.error.flatten()
    );
  const session = await getDemoSession(parsed.data.sessionId);
  if (!session) return jsonError(res, 404, "Demo session not found");
  const seedItems = demoSeeds[parsed.data.targetStep].map(item => ({
    ...item,
    tags: [`fieldmind-demo-${session.id}`],
  }));
  const retained = await retainBatch({ items: seedItems });
  const nextSession = await updateDemoSession(session.id, {
    memoryStatus: retained.status,
    completedSteps: [
      ...new Set([...session.completedSteps, parsed.data.targetStep]),
    ],
  });
  res.json({
    session: nextSession ?? session,
    addedMemoryCount: retained.itemsCount,
    retainStatus: retained.status,
    sourceNote:
      retained.status === "connected"
        ? `Retained ${retained.itemsCount} synthetic but realistic Hindsight experiences for the next demo stage.`
        : (retained.error ?? "Hindsight could not be updated."),
  });
});

apiRouter.post("/incidents", async (req, res) => {
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success)
    return jsonError(res, 400, "Invalid incident", parsed.error.flatten());
  const input = parsed.data as IncidentInput;
  const interactionNumber = (await countIncidents(input.demoSessionId)) + 1;
  const created = await insertIncident(
    toIncidentRecord(input, interactionNumber)
  );
  const analysis = await analyzeIncident(input);
  const incident = (await updateIncident(created.id, {
    status: "open",
    recommendation: analysis.recommendation,
    memoryStatus: analysis.memoryStatus,
    llmStatus: analysis.llmStatus,
  })) ?? { ...created, ...analysis };
  if (input.demoSessionId)
    await updateDemoSession(input.demoSessionId, {
      interactionCount: interactionNumber,
      memoryStatus: analysis.memoryStatus,
    });
  res.json({
    incident,
    memories: analysis.memories,
    memoryStatus: analysis.memoryStatus,
    llmStatus: analysis.llmStatus,
    recommendation: analysis.recommendation,
    sourceNote: analysis.sourceNote,
  });
});

apiRouter.get("/incidents/:id", async (req, res) => {
  const incident = await getIncident(req.params.id);
  if (!incident) return jsonError(res, 404, "Incident not found");
  const resolution = await getResolutionForIncident(incident.id);
  res.json({ incident, resolution });
});

apiRouter.post("/incidents/:id/resolve", async (req, res) => {
  const parsed = resolutionSchema.safeParse(req.body);
  if (!parsed.success)
    return jsonError(res, 400, "Invalid resolution", parsed.error.flatten());
  const incident = await getIncident(req.params.id);
  if (!incident) return jsonError(res, 404, "Incident not found");
  const input = parsed.data as ResolutionInput;
  const resolutionId = crypto.randomUUID();
  const { learning, result: retained } = await retainIncidentLearning(
    incident,
    { ...input, incidentId: incident.id },
    incident.demoSessionId
  );
  const resolution = await insertResolution({
    ...input,
    id: resolutionId,
    incidentId: incident.id,
    resolvedAt: new Date().toISOString(),
    retainedLearning: retained.retained ? learning : undefined,
    retainStatus: toResolutionLearningStatus(retained.status),
  });
  const updatedIncident = (await updateIncident(incident.id, {
    status: input.resolved ? "resolved" : "unresolved",
  })) ?? { ...incident, status: input.resolved ? "resolved" : "unresolved" };
  if (incident.demoSessionId) {
    const session = await getDemoSession(incident.demoSessionId);
    if (session)
      await updateDemoSession(session.id, {
        completedSteps: [
          ...new Set([...session.completedSteps, incident.interactionNumber]),
        ],
      });
  }
  res.json({
    incident: updatedIncident,
    resolution,
    retainedLearning: retained.retained ? learning : null,
    retainStatus: retained.status,
    sourceNote: retained.retained
      ? "Useful resolution knowledge was retained in Hindsight and is available to future related incidents."
      : (retained.error ??
        "Resolution was saved, but Hindsight did not retain the learning."),
  });
});

apiRouter.get("/equipment/:equipmentId", async (req, res) => {
  const equipment = getEquipment(req.params.equipmentId);
  const history = await listEquipmentHistory(req.params.equipmentId);
  res.json({ equipmentId: req.params.equipmentId, equipment, ...history });
});

apiRouter.get("/memory/recent", async (_req, res) => {
  const recalled = await recallRecent();
  res.json({ ...recalled, resolutions: await listRecentResolutions(10) });
});

apiRouter.get("/equipment", async (_req, res) => {
  res.json({ equipment: equipmentCatalogSnapshot() });
});
