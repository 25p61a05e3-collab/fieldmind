import type {
  IncidentInput,
  MemoryReference,
  ProviderStatus,
  Recommendation,
} from "@shared/types";
import { z } from "zod";

const RecommendationSchema = z.object({
  summary: z.string().min(1),
  recommendedAction: z.string().min(1),
  why: z.string().min(1),
  sequence: z.array(z.string().min(1)).min(1).max(6),
  warnings: z.array(z.string().min(1)).max(5),
  rootCauseHypotheses: z.array(z.string().min(1)).max(5),
  memoryInfluence: z.string().min(1),
});

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const groqKey = () => process.env.GROQ_API_KEY?.trim();

const groqBaseUrl = () =>
  (process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1").replace(
    /\/$/,
    ""
  );

const groqModel = () =>
  process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

export function groqProviderStatus(): ProviderStatus {
  return groqKey() ? "connected" : "not_configured";
}

function stripJsonFences(content: string): string {
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Keeps model output inside the application's recommendation contract.
 *
 * The model is instructed to respect these limits, but this defensive
 * normalization prevents a single extra item from breaking the entire
 * FieldMind analysis.
 */
function normalizeRecommendationPayload(
  value: unknown
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const payload = value as Record<string, unknown>;

  return {
    ...payload,

    ...(Array.isArray(payload.sequence)
      ? {
          sequence: payload.sequence
            .filter((item): item is string => typeof item === "string")
            .slice(0, 6),
        }
      : {}),

    ...(Array.isArray(payload.warnings)
      ? {
          warnings: payload.warnings
            .filter((item): item is string => typeof item === "string")
            .slice(0, 5),
        }
      : {}),

    ...(Array.isArray(payload.rootCauseHypotheses)
      ? {
          rootCauseHypotheses: payload.rootCauseHypotheses
            .filter((item): item is string => typeof item === "string")
            .slice(0, 5),
        }
      : {}),
  };
}

function buildPrompt(
  incident: IncidentInput,
  memories: MemoryReference[]
): string {
  const evidence =
    memories.length === 0
      ? "No relevant Hindsight memories were retrieved. Do not imply that historical experience influenced the recommendation."
      : memories.map((memory, index) => ({
          evidenceNumber: index + 1,
          fact: memory.text,
          type: memory.type,
          context: memory.context ?? null,
          equipmentId: memory.equipmentId ?? null,
          occurredAt: memory.occurredAt ?? null,
          metadata: memory.metadata,
        }));

  return [
    "You are FieldMind, a field-service troubleshooting assistant for one technician.",

    "Return ONLY valid JSON matching the requested schema.",
    "Do not use Markdown.",
    "Do not expose chain-of-thought or confidence percentages.",

    "Ground claims in the incident and the supplied Hindsight evidence.",
    "Separate evidence-backed observations from hypotheses.",

    "Recommend a practical, safety-aware sequence for a technician investigating recurring equipment trouble.",

    "STRICT OUTPUT LIMITS:",
    "- sequence MUST contain between 1 and 6 items.",
    "- warnings MUST contain at most 5 items.",
    "- rootCauseHypotheses MUST contain at most 5 items.",
    "- Keep each sequence item concise and actionable.",
    "- Do not add extra JSON fields.",

    "If evidence is absent, be appropriately generic.",
    "If evidence is present, make the change in recommendation explicit.",

    `INCIDENT\n${JSON.stringify(incident)}`,

    `HINDSIGHT_EVIDENCE\n${JSON.stringify(evidence)}`,

    'JSON SHAPE\n{"summary": string, "recommendedAction": string, "why": string, "sequence": string[], "warnings": string[], "rootCauseHypotheses": string[], "memoryInfluence": string}',
  ].join("\n\n");
}

export async function reasonAboutIncident(
  incident: IncidentInput,
  memories: MemoryReference[]
): Promise<{
  status: ProviderStatus;
  recommendation?: Recommendation;
  error?: string;
}> {
  if (groqProviderStatus() !== "connected") {
    return {
      status: "not_configured",
      error: "Configure GROQ_API_KEY before using AI reasoning.",
    };
  }

  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    Number(process.env.GROQ_TIMEOUT_MS ?? 18000)
  );

  try {
    const response = await fetch(
      `${groqBaseUrl()}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: groqModel(),

          temperature: 0.2,

          /*
           * GPT-OSS models can spend completion tokens on reasoning.
           * Give the response enough room to finish the JSON document.
           */
          max_completion_tokens: 4096,

          /*
           * Keep reasoning focused so the model has enough completion
           * budget for the actual recommendation JSON.
           */
          reasoning_effort: "low",

          response_format: {
            type: "json_object",
          },

          messages: [
            {
              role: "user",
              content: buildPrompt(incident, memories),
            },
          ],
        }),
        signal: controller.signal,
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(
        `Groq ${response.status}: ${raw.slice(0, 400)}`
      );
    }

    const payload = JSON.parse(raw) as GroqResponse;

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Groq returned no message content");
    }

    const parsedJson = JSON.parse(
      stripJsonFences(content)
    );

    /*
     * Defensive normalization:
     * If the model produces 7 sequence items instead of 6,
     * keep the first 6 rather than failing the complete incident analysis.
     */
    const normalized = normalizeRecommendationPayload(
      parsedJson
    );

    const parsed = RecommendationSchema.safeParse(
      normalized
    );

    if (!parsed.success) {
      throw new Error(
        `Groq JSON did not match the recommendation contract: ${parsed.error.message}`
      );
    }

    return {
      status: "connected",
      recommendation: {
        ...parsed.data,
        source: "groq",
      },
    };
  } catch (error) {
    console.error("Groq reasoning failed", error);

    return {
      status: "unavailable",
      error:
        error instanceof Error
          ? error.message
          : "Unknown Groq error",
    };
  } finally {
    clearTimeout(timer);
  }
}