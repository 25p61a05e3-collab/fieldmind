import { describe, expect, it } from "vitest";
import { z } from "zod";

const RecommendationSchema = z.object({
  summary: z.string().min(1),
  recommendedAction: z.string().min(1),
  why: z.string().min(1),
  sequence: z.array(z.string().min(1)).min(1),
  warnings: z.array(z.string().min(1)),
  rootCauseHypotheses: z.array(z.string().min(1)),
  memoryInfluence: z.string().min(1),
});

describe("Groq response contract", () => {
  it("accepts the documented recommendation shape", () => {
    const result = RecommendationSchema.safeParse({
      summary: "Coupling checks should come first.",
      recommendedAction: "Check alignment.",
      why: "A prior resolution used alignment.",
      sequence: ["Isolate", "Measure"],
      warnings: ["Follow lockout/tagout."],
      rootCauseHypotheses: ["Misalignment"],
      memoryInfluence: "Hindsight evidence changed the first action.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed model output instead of fabricating a recommendation", () => {
    const result = RecommendationSchema.safeParse({
      summary: "missing required fields",
    });
    expect(result.success).toBe(false);
  });
});
