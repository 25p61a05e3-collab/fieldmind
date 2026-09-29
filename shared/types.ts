export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "analyzing" | "open" | "resolved" | "unresolved";
export type MemoryStatus =
  | "connected"
  | "empty"
  | "unavailable"
  | "not_configured";
export type ProviderStatus = "connected" | "unavailable" | "not_configured";
export type ResolutionResult = "resolved" | "partially_resolved" | "failed";

export interface IncidentInput {
  equipmentId: string;
  equipmentType: string;
  location: string;
  reportedIssue: string;
  symptoms: string;
  severity: IncidentSeverity;
  operatingContext: string;
  demoSessionId?: string;
}

export interface IncidentRecord extends IncidentInput {
  id: string;
  status: IncidentStatus;
  createdAt: string;
  interactionNumber: number;
  recommendation?: Recommendation;
  memoryStatus?: MemoryStatus;
  llmStatus?: ProviderStatus;
  persistenceStatus?: "mongodb" | "ephemeral";
}

export interface MemoryReference {
  id: string;
  text: string;
  type: "world" | "experience" | "observation" | "unknown";
  context?: string;
  equipmentId?: string;
  documentId?: string;
  occurredAt?: string;
  mentionedAt?: string;
  tags: string[];
  metadata: Record<string, string>;
  relevanceReason: string;
}

export interface Recommendation {
  summary: string;
  recommendedAction: string;
  why: string;
  sequence: string[];
  warnings: string[];
  rootCauseHypotheses: string[];
  memoryInfluence: string;
  source: "groq" | "fallback";
}

export interface AnalysisResponse {
  incident: IncidentRecord;
  memories: MemoryReference[];
  memoryStatus: MemoryStatus;
  llmStatus: ProviderStatus;
  recommendation: Recommendation;
  sourceNote: string;
}

export interface ResolutionInput {
  rootCause: string;
  actionsTaken: string;
  result: ResolutionResult;
  resolved: boolean;
  technicianFeedback: string;
  notes: string;
}

export interface ResolutionRecord extends ResolutionInput {
  id: string;
  incidentId: string;
  resolvedAt: string;
  retainedLearning?: string;
  retainStatus?: MemoryStatus;
  persistenceStatus?: "mongodb" | "ephemeral";
}

export interface ResolutionResponse {
  incident: IncidentRecord;
  resolution: ResolutionRecord;
  retainedLearning: string | null;
  retainStatus: MemoryStatus;
  sourceNote: string;
}

export interface EquipmentHistoryResponse {
  equipmentId: string;
  equipment?: {
    equipmentId: string;
    name: string;
    type: string;
    model: string;
    location: string;
    status: string;
  };
  incidents: IncidentRecord[];
  resolutions: ResolutionRecord[];
  persistenceStatus: "mongodb" | "ephemeral";
}

export interface DemoScenario {
  step: 1 | 5 | 10 | 20;
  label: string;
  helper: string;
  incident: IncidentInput;
}

export interface DemoSession {
  id: string;
  interactionCount: number;
  completedSteps: number[];
  memoryStatus: MemoryStatus;
  scenarios: DemoScenario[];
  createdAt: string;
}

export interface DemoAdvanceResponse {
  session: DemoSession;
  addedMemoryCount: number;
  retainStatus: MemoryStatus;
  sourceNote: string;
}

export interface ServiceStatus {
  mongo: ProviderStatus;
  hindsight: ProviderStatus;
  groq: ProviderStatus;
}

export interface DemoStatusResponse {
  serviceStatus: ServiceStatus;
  session?: DemoSession;
  recentRetainedCount: number;
}
