import { describe, expect, it } from "vitest";

import {
  SAMPLE_WORKSPACE_DELETE_PHRASE,
  createClearedSampleWorkspace,
  createSampleWorkspaceExport,
} from "@/lib/account/sample-workspace";
import { createDemoState } from "@/lib/demo/fixtures";

describe("sample workspace account controls", () => {
  it("exports an inspectable data-only snapshot with an explicit local notice", () => {
    const state = {
      ...createDemoState(),
      resetDemo: () => undefined,
    };

    const exported = createSampleWorkspaceExport(
      state,
      "2026-07-13T14:00:00.000Z",
    );
    const serialized = JSON.stringify(exported);

    expect(exported).toMatchObject({
      schema: "museboard.sample-workspace",
      schemaVersion: 1,
      exportedAt: "2026-07-13T14:00:00.000Z",
      notice: expect.stringMatching(/this device/i),
      workspace: {
        dataMode: "sample",
        content: expect.any(Array),
        plannerTasks: expect.any(Array),
      },
    });
    expect(serialized).not.toContain("resetDemo");
    expect(serialized).not.toContain("function");
  });

  it("creates a genuinely empty sample workspace rather than restoring fixtures", () => {
    const cleared = createClearedSampleWorkspace("2026-08-01T00:00:00.000Z");

    expect(SAMPLE_WORKSPACE_DELETE_PHRASE).toBe("DELETE SAMPLE WORKSPACE");
    expect(cleared).toMatchObject({
      dataMode: "sample",
      onboardingComplete: false,
      creator: undefined,
      opportunities: [],
      content: [],
      plannerTasks: [],
      memberships: [],
      entitlementUsage: {
        plan: "free",
        used: {},
        reserved: {},
        resetAt: "2026-08-01T00:00:00.000Z",
      },
    });
  });
});
