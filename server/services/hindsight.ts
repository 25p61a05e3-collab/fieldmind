import type {
  MemoryReference,
  MemoryStatus,
  ProviderStatus,
} from "@shared/types";

interface HindsightMemoryPayload {
  id?: string;
  text?: string;
  type?: string;
  context?: string;
  entities?: string[];
  metadata?: Record<string, unknown>;
  tags?: string[];
  document_id?: string;
  occurred_start?: string;
  occurred_end?: string;
  mentioned_at?: string;
}

interface HindsightRecallResponse {
  results?: HindsightMemoryPayload[];
}

interface HindsightRetainItem {
  content: string;
  context: string;
  timestamp: string;
  document_id: string;
  metadata: Record<string, string>;
  tags: string[];
}

export interface HindsightRecallInput {
  query: string;
  tags?: string[];
}

export interface HindsightRetainInput {
  content: string;
  context: string;
  timestamp?: string;
  documentId: string;
  metadata?: Record<string, string>;
  tags?: string[];
}

export interface HindsightBatchRetainInput {
  items: HindsightRetainItem[];
}

export interface HindsightRecallResult {
  status: MemoryStatus;
  memories: MemoryReference[];
  error?: string;
}

export interface HindsightRetainResult {
  status: MemoryStatus;
  retained: boolean;
  itemsCount: number;
  error?: string;
}

const baseUrl = () => (process.env.HINDSIGHT_BASE_URL ?? "").replace(/\/$/, "");
const apiKey = () => process.env.HINDSIGHT_API_KEY?.trim();
const bankId = () => process.env.HINDSIGHT_BANK_ID?.trim();
const timeoutMs = () => Number(process.env.HINDSIGHT_TIMEOUT_MS ?? 12000);

export function hindsightProviderStatus(): ProviderStatus {
  return baseUrl() && apiKey() && bankId() ? "connected" : "not_configured";
}

function authHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey()}`,
  };
}

async function callHindsight<T>(path: string, body: unknown): Promise<T> {
  if (hindsightProviderStatus() !== "connected") {
    throw new Error("Hindsight is not configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      const detail =
        parsed && typeof parsed === "object" ? JSON.stringify(parsed) : raw;
      throw new Error(`Hindsight ${response.status}: ${detail.slice(0, 400)}`);
    }
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

function metadataToStrings(
  metadata: Record<string, unknown> | undefined
): Record<string, string> {
  if (!metadata) return {};
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      typeof value === "string" ? value : String(value),
    ])
  );
}

function relevanceReason(
  memory: HindsightMemoryPayload,
  query: string
): string {
  const haystack =
    `${memory.text ?? ""} ${memory.context ?? ""} ${(memory.entities ?? []).join(" ")}`.toLowerCase();
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter(term => term.length > 3);
  const matched = [
    ...new Set(terms.filter(term => haystack.includes(term))),
  ].slice(0, 3);
  return matched.length > 0
    ? `Hindsight matched the current issue on ${matched.join(", ")}.`
    : "Hindsight ranked this experience as related to the current troubleshooting query.";
}

function mapMemory(
  memory: HindsightMemoryPayload,
  query: string
): MemoryReference | null {
  if (!memory.id || !memory.text) return null;
  const metadata = metadataToStrings(memory.metadata);
  return {
    id: memory.id,
    text: memory.text,
    type:
      memory.type === "world" ||
      memory.type === "experience" ||
      memory.type === "observation"
        ? memory.type
        : "unknown",
    context: memory.context,
    equipmentId: metadata.equipmentId ?? metadata.equipment_id,
    documentId: memory.document_id,
    occurredAt: memory.occurred_start ?? memory.occurred_end,
    mentionedAt: memory.mentioned_at,
    tags: Array.isArray(memory.tags)
      ? memory.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    metadata,
    relevanceReason: relevanceReason(memory, query),
  };
}

export async function recallRelevant(
  input: HindsightRecallInput
): Promise<HindsightRecallResult> {
  if (hindsightProviderStatus() !== "connected") {
    return {
      status: "not_configured",
      memories: [],
      error:
        "Configure HINDSIGHT_BASE_URL, HINDSIGHT_API_KEY, and HINDSIGHT_BANK_ID.",
    };
  }
  try {
    const body: Record<string, unknown> = {
      query: input.query,
      types: ["world", "experience", "observation"],
      prefer_observations: true,
      budget: "mid",
      max_tokens: 2600,
      query_timestamp: new Date().toISOString(),
    };
    if (input.tags?.length) {
      body.tags = input.tags;
      body.tags_match = "all_strict";
    }
    const response = await callHindsight<HindsightRecallResponse>(
      `/v1/default/banks/${encodeURIComponent(bankId()!)}/memories/recall`,
      body
    );
    const memories = (response.results ?? [])
      .map(result => mapMemory(result, input.query))
      .filter((memory): memory is MemoryReference => Boolean(memory))
      .slice(0, 8);
    return { status: memories.length > 0 ? "connected" : "empty", memories };
  } catch (error) {
    console.error("Hindsight recall failed", error);
    return {
      status: "unavailable",
      memories: [],
      error: error instanceof Error ? error.message : "Unknown Hindsight error",
    };
  }
}

export async function retainLearning(
  input: HindsightRetainInput
): Promise<HindsightRetainResult> {
  return retainBatch({
    items: [
      {
        content: input.content,
        context: input.context,
        timestamp: input.timestamp ?? new Date().toISOString(),
        document_id: input.documentId,
        metadata: input.metadata ?? {},
        tags: input.tags ?? [],
      },
    ],
  });
}

export async function retainBatch(
  input: HindsightBatchRetainInput
): Promise<HindsightRetainResult> {
  if (hindsightProviderStatus() !== "connected") {
    return {
      status: "not_configured",
      retained: false,
      itemsCount: 0,
      error: "Configure Hindsight before retaining learning.",
    };
  }
  try {
    const response = await callHindsight<{
      success?: boolean;
      items_count?: number;
    }>(`/v1/default/banks/${encodeURIComponent(bankId()!)}/memories`, {
      async: false,
      items: input.items,
    });
    const itemsCount = Number(response.items_count ?? input.items.length);
    return {
      status: response.success === false ? "unavailable" : "connected",
      retained: response.success !== false,
      itemsCount,
    };
  } catch (error) {
    console.error("Hindsight retain failed", error);
    return {
      status: "unavailable",
      retained: false,
      itemsCount: 0,
      error: error instanceof Error ? error.message : "Unknown Hindsight error",
    };
  }
}

export async function recallRecent(): Promise<HindsightRecallResult> {
  return recallRelevant({
    query:
      "recent resolved field service equipment troubleshooting outcomes and technician lessons",
  });
}
