import { describe, expect, it } from "vitest";

import { manualPlanningLabel } from "@/components/marketing/plan-copy";
import { PLAN_CATALOG } from "@/domain/entitlements";

describe("pricing copy", () => {
  it("derives the manual-planning label from the plan catalog value", () => {
    expect(manualPlanningLabel(PLAN_CATALOG.free.manualPlanning)).toBe(
      "Unlimited manual planning",
    );
  });
});
