import type {
  IncidentInput,
  MemoryReference,
  Recommendation,
  ResolutionInput,
  ProviderStatus,
} from "@shared/types";
import { groqProviderStatus, reasonAboutIncident } from "./groq";
import {
  hindsightProviderStatus,
  recallRelevant,
  retainLearning,
  type HindsightRetainResult,
} from "./hindsight";

export interface AgentAnalysis {
  memories: MemoryReference[];
  memoryStatus: "connected" | "empty" | "unavailable" | "not_configured";
  llmStatus: ProviderStatus;
  recommendation: Recommendation;
  sourceNote: string;
}

function fallbackRecommendation(
  incident: IncidentInput,
  memories: MemoryReference[],
  memoryStatus: AgentAnalysis["memoryStatus"],
  llmStatus: ProviderStatus
): Recommendation {
  const hasVibration = /vibrat|oscillat|coupling|alignment/i.test(
    `${incident.reportedIssue} ${incident.symptoms}`
  );
  const hasHeat = /heat|overheat|temperature/i.test(
    `${incident.reportedIssue} ${incident.symptoms}`
  );
  const hasHistoricalEvidence =
    memoryStatus === "connected" && memories.length > 0;
  const recommendedAction =
    hasVibration && hasHistoricalEvidence
      ? "Inspect coupling alignment, mounting torque, and vibration readings before replacing components."
      : hasVibration
        ? "Check bearing condition, shaft alignment, mounting, coupling, imbalance, and vibration readings in sequence."
        : hasHeat
          ? "Verify cooling flow, temperature readings, and load conditions before restarting the equipment."
          : "Follow the site isolation procedure, capture measurements, and inspect the most likely mechanical and electrical causes in sequence.";
  const sequence =
    hasVibration && hasHistoricalEvidence
      ? [
          "Isolate the equipment and verify the coupling guard is safe to open.",
          "Check coupling alignment and mounting torque.",
          "Measure vibration at the drive and non-drive ends.",
          "Only then investigate bearing or component replacement.",
        ]
      : hasVibration
        ? [
            "Isolate the equipment and verify the coupling guard is safe to open.",
            "Check bearing condition, shaft alignment, mounting, and coupling.",
            "Measure vibration and compare against the normal operating range.",
            "Investigate imbalance or component replacement only after measurements.",
          ]
        : hasHeat
          ? [
              "Isolate the equipment and confirm the temperature reading with an independent measurement.",
              "Check cooling flow, filters, and ventilation.",
              "Compare load and operating conditions with the normal range.",
              "Document the result before returning the equipment to service.",
            ]
          : [
              "Make the equipment safe and capture the failure conditions.",
              "Check the simplest physical causes first.",
              "Take measurements before changing components.",
              "Record the result and any repeatable field observation.",
            ];
  return {
    summary:
      llmStatus === "not_configured" || llmStatus === "unavailable"
        ? "AI reasoning is unavailable; use this clearly labeled safety-first checklist while configuration is completed."
        : "No generated recommendation was available for this incident.",
    recommendedAction,
    why:
      memoryStatus === "connected"
        ? "Hindsight returned experience, but Groq could not turn it into a generated recommendation. Review the evidence cards before acting."
        : "No historical experience was available to personalize this checklist.",
    sequence,
    warnings: [
      "Follow site isolation and lockout/tagout procedures before inspection.",
      "Do not replace components based on symptoms alone; record measurements first.",
    ],
    rootCauseHypotheses:
      hasVibration && hasHistoricalEvidence
        ? [
            "Coupling alignment or mounting issue",
            "Bearing or shaft condition",
            "Rotating imbalance",
          ]
        : hasVibration
          ? [
              "Bearing or shaft condition",
              "Alignment, mounting, or coupling issue",
              "Rotating imbalance",
            ]
          : [
              "Operating condition outside normal range",
              "Mechanical wear or obstruction",
              "Sensor or measurement fault",
            ],
    memoryInfluence:
      memories.length > 0
        ? `${memories.length} Hindsight memories were recalled; inspect them manually because AI reasoning is unavailable.`
        : "No Hindsight memory influenced this checklist.",
    source: "fallback",
  };
}

export async function analyzeIncident(
  incident: IncidentInput
): Promise<AgentAnalysis> {
  const query = [
    `Equipment ${incident.equipmentId} (${incident.equipmentType})`,
    `reported issue: ${incident.reportedIssue}`,
    `symptoms: ${incident.symptoms}`,
    `operating context: ${incident.operatingContext}`,
    "Find previous field-service incidents, failed attempts, successful repairs, and recurring patterns that should influence the first diagnostic action.",
  ].join(". ");
  const recall = await recallRelevant({
    query,
    tags: incident.demoSessionId
      ? [`fieldmind-demo-${incident.demoSessionId}`]
      : undefined,
  });
  const reasoning = await reasonAboutIncident(incident, recall.memories);
  const recommendation =
    reasoning.recommendation ??
    fallbackRecommendation(
      incident,
      recall.memories,
      recall.status,
      reasoning.status
    );
  const sourceNote =
    recall.status === "unavailable"
      ? "Memory service unavailable — this recommendation was generated without historical experience."
      : recall.status === "not_configured"
        ? "Hindsight is not configured — this recommendation was generated without historical experience."
        : reasoning.status === "not_configured" ||
            reasoning.status === "unavailable"
          ? "Hindsight recall completed, but Groq reasoning is unavailable; the checklist is explicitly labeled as a fallback."
          : recall.status === "empty"
            ? "No relevant Hindsight memory was found, so this is a first-pass recommendation."
            : "This recommendation was generated using the Hindsight memories shown alongside it.";
  return {
    memories: recall.memories,
    memoryStatus: recall.status,
    llmStatus: reasoning.status,
    recommendation,
    sourceNote,
  };
}

export function extractLearning(
  incident: IncidentInput,
  resolution: ResolutionInput
): string {
  const outcome = resolution.resolved
    ? "The issue was resolved."
    : `The issue was ${resolution.result.replace("_", " ")}.`;
  return [
    `Field service learning for ${incident.equipmentId} (${incident.equipmentType}) at ${incident.location}.`,
    `Incident: ${incident.reportedIssue}. Symptoms: ${incident.symptoms}. Operating context: ${incident.operatingContext}.`,
    `Confirmed or suspected root cause: ${resolution.rootCause}.`,
    `Actions taken: ${resolution.actionsTaken}. Result: ${resolution.result}. ${outcome}`,
    `Technician feedback: ${resolution.technicianFeedback}. Notes: ${resolution.notes}.`,
    "Use this experience to guide future troubleshooting of the same equipment or similar recurring symptoms; do not skip safety isolation or measurement.",
  ].join(" ");
}

export async function retainIncidentLearning(
  incident: IncidentInput,
  resolution: ResolutionInput & { incidentId: string },
  demoSessionId?: string
): Promise<{ learning: string; result: HindsightRetainResult }> {
  const learning = extractLearning(incident, resolution);
  const result = await retainLearning({
    content: learning,
    context: "field-service resolution",
    documentId: `fieldmind-resolution-${resolution.incidentId}`,
    metadata: {
      equipmentId: incident.equipmentId,
      equipmentType: incident.equipmentType,
      incidentId: resolution.incidentId,
      result: resolution.result,
      resolved: String(resolution.resolved),
      source: "fieldmind",
    },
    tags: demoSessionId ? [`fieldmind-demo-${demoSessionId}`] : [],
  });
  return { learning, result };
}

export function agentProviderStatus(): {
  hindsight: ProviderStatus;
  groq: ProviderStatus;
} {
  return { hindsight: hindsightProviderStatus(), groq: groqProviderStatus() };
}
