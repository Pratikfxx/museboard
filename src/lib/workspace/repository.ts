import type { Plan } from "@/domain/entitlements";
import type { DemoMuseboardData } from "@/lib/demo/fixtures";
import {
  normalizeLiveWorkspacePayload,
  workspaceSnapshotSaveSchema,
  type LiveWorkspaceAuthority,
} from "@/lib/workspace/snapshot";
import { z } from "zod";

interface RepositoryError {
  code?: string;
  message: string;
}

export interface SupabaseWorkspaceSnapshotClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: unknown; error: RepositoryError | null }>;
      };
    };
  };
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: RepositoryError | null }>;
}

const workspaceSnapshotRowSchema = z.object({
  schema_version: z.literal(1),
  revision: z.number().int().positive(),
  payload: z.unknown(),
});

export interface WorkspaceSnapshotRow {
  schemaVersion: 1;
  revision: number;
  payload: unknown;
}

export interface WorkspaceSnapshotStore {
  load(organizationId: string): Promise<WorkspaceSnapshotRow | null>;
  save(input: {
    organizationId: string;
    expectedRevision: number;
    schemaVersion: 1;
    payload: DemoMuseboardData;
  }): Promise<number>;
}

export interface CanonicalWorkspaceSnapshot {
  revision: number;
  payload: DemoMuseboardData;
}

export class WorkspaceRevisionConflictError extends Error {
  constructor() {
    super("This workspace changed on another device. Reload before saving again.");
    this.name = "WorkspaceRevisionConflictError";
  }
}

export function createSupabaseWorkspaceSnapshotStore(
  client: SupabaseWorkspaceSnapshotClient,
): WorkspaceSnapshotStore {
  return {
    async load(organizationId) {
      const { data, error } = await client
        .from("workspace_snapshots")
        .select("schema_version, revision, payload")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = workspaceSnapshotRowSchema.parse(data);
      return {
        schemaVersion: row.schema_version,
        revision: row.revision,
        payload: row.payload,
      };
    },
    async save(input) {
      const { data, error } = await client.rpc("save_workspace_snapshot", {
        p_organization_id: input.organizationId,
        p_expected_revision: input.expectedRevision,
        p_schema_version: input.schemaVersion,
        p_payload: input.payload,
      });
      if (error?.code === "40001" || error?.message.includes("revision conflict")) {
        throw new WorkspaceRevisionConflictError();
      }
      if (error) throw new Error(error.message);
      return z.number().int().positive().parse(data);
    },
  };
}

export function entitlementResetAt(plan: Plan, now = new Date()): string {
  if (plan === "free") {
    const reset = new Date(now);
    reset.setUTCHours(0, 0, 0, 0);
    const daysUntilNextMonday = (8 - reset.getUTCDay()) % 7 || 7;
    reset.setUTCDate(reset.getUTCDate() + daysUntilNextMonday);
    return reset.toISOString();
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

export async function loadCanonicalWorkspace(
  store: WorkspaceSnapshotStore,
  organizationId: string,
  authority: LiveWorkspaceAuthority,
): Promise<CanonicalWorkspaceSnapshot | null> {
  const row = await store.load(organizationId);
  if (!row) return null;
  if (row.schemaVersion !== 1 || !Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new Error("The durable workspace revision is invalid");
  }
  return {
    revision: row.revision,
    payload: normalizeLiveWorkspacePayload(row.payload, authority),
  };
}

export async function saveCanonicalWorkspace(
  store: WorkspaceSnapshotStore,
  input: unknown,
  authority: LiveWorkspaceAuthority,
): Promise<CanonicalWorkspaceSnapshot> {
  const parsed = workspaceSnapshotSaveSchema.parse(input);
  const payload = normalizeLiveWorkspacePayload(parsed.payload, authority);
  const revision = await store.save({
    organizationId: parsed.organizationId,
    expectedRevision: parsed.expectedRevision,
    schemaVersion: 1,
    payload,
  });
  return { revision, payload };
}
