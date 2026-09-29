import type {
  AnalysisResponse,
  DemoAdvanceResponse,
  DemoSession,
  DemoStatusResponse,
  EquipmentHistoryResponse,
  IncidentInput,
  ResolutionInput,
  ResolutionResponse,
  ServiceStatus,
} from "@shared/types";

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : `Request failed with ${response.status}`
    );
  }

  return payload as T;
}

export interface HealthResponse {
  status: string;
  serviceStatus: ServiceStatus;
  timestamp: string;
}

export interface RecentMemoryResponse {
  status: "connected" | "empty" | "unavailable" | "not_configured";
  memories: AnalysisResponse["memories"];
  resolutions: ResolutionResponse["resolution"][];
  error?: string;
}

export const api = {
  // Uses the working FieldMind status endpoint.
  health: () => request<HealthResponse>("/api/demo/status"),

  demoStatus: (sessionId?: string) =>
    request<DemoStatusResponse>(
      `/api/demo/status${
        sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""
      }`
    ),

  startDemo: () =>
    request<{ session: DemoSession; sourceNote: string }>("/api/demo/start", {
      method: "POST",
      body: "{}",
    }),

  advanceDemo: (sessionId: string, targetStep: 5 | 10 | 20) =>
    request<DemoAdvanceResponse>("/api/demo/advance", {
      method: "POST",
      body: JSON.stringify({ sessionId, targetStep }),
    }),

  analyzeIncident: (incident: IncidentInput) =>
    request<AnalysisResponse>("/api/incidents", {
      method: "POST",
      body: JSON.stringify(incident),
    }),

  getIncident: (id: string) =>
    request<{
      incident: AnalysisResponse["incident"];
      resolution: ResolutionResponse["resolution"] | null;
    }>(`/api/incidents/${encodeURIComponent(id)}`),

  resolveIncident: (id: string, resolution: ResolutionInput) =>
    request<ResolutionResponse>(
      `/api/incidents/${encodeURIComponent(id)}/resolve`,
      {
        method: "POST",
        body: JSON.stringify(resolution),
      }
    ),

  equipmentHistory: (equipmentId: string) =>
    request<EquipmentHistoryResponse>(
      `/api/equipment/${encodeURIComponent(equipmentId)}`
    ),

  recentMemory: () =>
    request<RecentMemoryResponse>("/api/memory/recent"),
};