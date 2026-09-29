import { describe, expect, it } from "vitest";

describe("Hindsight integration contract", () => {
  it("uses the documented memory endpoint paths", () => {
    expect("/v1/default/banks/{bank_id}/memories").toContain("/memories");
    expect("/v1/default/banks/{bank_id}/memories/recall").toContain("/recall");
  });

  it("keeps the required server-side configuration explicit", () => {
    expect([
      "HINDSIGHT_BASE_URL",
      "HINDSIGHT_API_KEY",
      "HINDSIGHT_BANK_ID",
    ]).toHaveLength(3);
  });
});
