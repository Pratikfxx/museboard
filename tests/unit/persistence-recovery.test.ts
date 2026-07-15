import { describe, expect, test } from "vitest";

import {
  inspectPersistedWorkspaceEnvelope,
  MAX_RECOVERY_BACKUP_BYTES,
} from "@/lib/store/recovery";
import { createDemoState } from "@/lib/demo/fixtures";
import { validatePersistedMuseboardData } from "@/lib/store/museboard-store";

const detectedAt = "2026-07-15T04:00:00.000Z";
const validator = (payload: unknown) => validatePersistedMuseboardData(payload).success;

describe("persisted workspace recovery", () => {
  test("accepts a valid Zustand workspace envelope", () => {
    const raw = JSON.stringify({ state: createDemoState(), version: 1 });

    expect(inspectPersistedWorkspaceEnvelope(raw, validator, detectedAt)).toEqual({
      ok: true,
      raw,
    });
  });

  test("quarantines malformed JSON instead of silently replacing it", () => {
    const raw = "{not-json";

    const result = inspectPersistedWorkspaceEnvelope(raw, validator, detectedAt);

    expect(result).toMatchObject({
      ok: false,
      rawBackup: raw,
      notice: {
        kind: "corrupt_json",
        backupKey: "museboard-recovery-backup-v1",
        detectedAt,
      },
    });
  });

  test("quarantines parseable envelopes whose workspace schema is invalid", () => {
    const raw = JSON.stringify({ state: { schemaVersion: 1 }, version: 1 });

    const result = inspectPersistedWorkspaceEnvelope(raw, validator, detectedAt);

    expect(result).toMatchObject({
      ok: false,
      rawBackup: raw,
      notice: {
        kind: "invalid_workspace",
        title: "Your saved workspace needs recovery",
      },
    });
  });

  test("bounds a recovery backup without losing its newest bytes", () => {
    const raw = `old-${"x".repeat(MAX_RECOVERY_BACKUP_BYTES)}-new`;

    const result = inspectPersistedWorkspaceEnvelope(raw, () => false, detectedAt);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected recovery result");
    expect(result.rawBackup.length).toBe(MAX_RECOVERY_BACKUP_BYTES);
    expect(result.rawBackup.endsWith("-new")).toBe(true);
  });
});
