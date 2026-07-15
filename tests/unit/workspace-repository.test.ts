import { describe, expect, it, vi } from "vitest";

import { createDemoState } from "@/lib/demo/fixtures";
import {
  entitlementResetAt,
  createSupabaseWorkspaceSnapshotStore,
  loadCanonicalWorkspace,
  saveCanonicalWorkspace,
  WorkspaceRevisionConflictError,
  type WorkspaceSnapshotStore,
} from "@/lib/workspace/repository";

const authority = {
  userId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
  email: "maya@example.com",
  displayName: "Maya Chen",
  plan: "pro" as const,
  resetAt: "2026-08-01T00:00:00.000Z",
};

describe("workspace snapshot repository", () => {
  it("adapts Supabase reads and saves with an explicit organization filter", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { schema_version: 1, revision: 3, payload: createDemoState() },
      error: null,
    }));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const rpc = vi.fn(async () => ({ data: 4, error: null }));
    const store = createSupabaseWorkspaceSnapshotStore({ from, rpc });

    await expect(store.load("4f0b3ec4-d507-4726-974c-9b1ea51f73b9"))
      .resolves.toMatchObject({ revision: 3, schemaVersion: 1 });
    expect(from).toHaveBeenCalledWith("workspace_snapshots");
    expect(eq).toHaveBeenCalledWith(
      "organization_id",
      "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
    );

    await expect(store.save({
      organizationId: "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
      expectedRevision: 3,
        schemaVersion: 1 as const,
      payload: createDemoState(),
    })).resolves.toBe(4);
    expect(rpc).toHaveBeenCalledWith("save_workspace_snapshot", expect.objectContaining({
      p_organization_id: "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
      p_expected_revision: 3,
    }));
  });

  it("maps Postgres serialization failures to revision conflicts", async () => {
    const store = createSupabaseWorkspaceSnapshotStore({
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: "40001", message: "workspace revision conflict" },
      })),
    });

    await expect(store.save({
      organizationId: "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
      expectedRevision: 2,
      schemaVersion: 1,
      payload: createDemoState(),
    })).rejects.toBeInstanceOf(WorkspaceRevisionConflictError);
  });

  it("loads and normalizes a tenant snapshot with server authority", async () => {
    const load = vi.fn(async () => ({
      schemaVersion: 1 as const,
      revision: 4,
      payload: createDemoState(),
    }));
    const store: WorkspaceSnapshotStore = {
      load,
      save: vi.fn(),
    };

    const result = await loadCanonicalWorkspace(
      store,
      "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
      authority,
    );

    expect(load).toHaveBeenCalledWith("4f0b3ec4-d507-4726-974c-9b1ea51f73b9");
    expect(result).toMatchObject({ revision: 4, payload: { dataMode: "live" } });
    expect(result?.payload.entitlementUsage.plan).toBe("pro");
  });

  it("normalizes untrusted payloads before compare-and-swap persistence", async () => {
    const save = vi.fn(async () => 8);
    const store: WorkspaceSnapshotStore = { load: vi.fn(), save };
    const payload = createDemoState();
    payload.entitlementUsage.plan = "studio";

    await expect(saveCanonicalWorkspace(store, {
      organizationId: "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
      expectedRevision: 7,
      payload,
    }, authority)).resolves.toMatchObject({ revision: 8 });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
      expectedRevision: 7,
      payload: expect.objectContaining({
        dataMode: "live",
        entitlementUsage: expect.objectContaining({ plan: "pro" }),
      }),
    }));
  });

  it("preserves revision conflicts as a distinct user-recoverable error", async () => {
    const store: WorkspaceSnapshotStore = {
      load: vi.fn(),
      save: vi.fn(async () => {
        throw new WorkspaceRevisionConflictError();
      }),
    };

    await expect(saveCanonicalWorkspace(store, {
      organizationId: "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
      expectedRevision: 2,
      payload: createDemoState(),
    }, authority)).rejects.toBeInstanceOf(WorkspaceRevisionConflictError);
  });

  it("uses weekly free and monthly paid entitlement reset boundaries", () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    expect(entitlementResetAt("free", now)).toBe("2026-07-20T00:00:00.000Z");
    expect(entitlementResetAt("creator", now)).toBe("2026-08-01T00:00:00.000Z");
  });
});
