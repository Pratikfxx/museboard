import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0001_museboard.sql"),
  "utf8",
).toLowerCase();
const workspaceBootstrap = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260715095934_auth_workspace_bootstrap.sql"),
  "utf8",
).toLowerCase();
const durableWorkspace = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260715105837_durable_workspace_snapshots.sql"),
  "utf8",
).toLowerCase();

describe("production database boundary", () => {
  it("makes Data API exposure explicit and enables RLS on every tenant table", () => {
    const tenantTables = [
      "organizations",
      "organization_memberships",
      "creator_profiles",
      "opportunities",
      "content_items",
      "content_versions",
      "planner_tasks",
      "collaboration_events",
      "export_records",
      "publish_receipts",
      "metric_samples",
      "billing_accounts",
      "subscription_entitlements",
      "usage_ledger",
    ];

    expect(migration).toContain("revoke all on table public.organizations from anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete");
    expect(migration).toContain("to authenticated");
    for (const table of tenantTables) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`alter table public.${table} force row level security`);
    }
  });

  it("keeps provider events private and hardens privileged functions", () => {
    expect(migration).toContain("create schema if not exists private");
    expect(migration).toContain("private.stripe_events");
    expect(migration).toContain("revoke all on schema private from public");
    expect(migration).toMatch(/security definer\s+set search_path = ''/u);
    expect(migration).toContain("select auth.uid()");
    expect(migration).toContain("revoke all on function public.claim_stripe_event");
  });

  it("uses organization membership predicates for tenant isolation", () => {
    expect(migration).toContain("private.is_organization_member");
    expect(migration).toContain("private.is_organization_owner");
    expect(migration).not.toContain("user_metadata");
    expect(migration).toMatch(/for update\s+to authenticated\s+using[\s\S]+with check/u);
  });

  it("creates the first authenticated workspace atomically without trusting metadata", () => {
    expect(workspaceBootstrap).toMatch(/security definer\s+set search_path = ''/u);
    expect(workspaceBootstrap).toContain("select auth.uid()");
    expect(workspaceBootstrap).toContain("pg_advisory_xact_lock");
    expect(workspaceBootstrap).toContain("insert into public.organizations");
    expect(workspaceBootstrap).toContain("insert into public.organization_memberships");
    expect(workspaceBootstrap).toContain("insert into public.creator_profiles");
    expect(workspaceBootstrap).toContain("revoke all on function public.ensure_user_workspace");
    expect(workspaceBootstrap).toContain("grant execute on function public.ensure_user_workspace");
    expect(workspaceBootstrap).not.toContain("raw_user_meta_data");
  });

  it("stores one revisioned creator workspace per organization behind member RLS", () => {
    expect(durableWorkspace).toContain("create table public.workspace_snapshots");
    expect(durableWorkspace).toContain("organization_id uuid primary key");
    expect(durableWorkspace).toContain("revision bigint not null");
    expect(durableWorkspace).toContain("payload jsonb not null");
    expect(durableWorkspace).toContain("enable row level security");
    expect(durableWorkspace).toContain("force row level security");
    expect(durableWorkspace).toContain("private.is_organization_member(organization_id)");
    expect(durableWorkspace).toContain("array['owner', 'editor']");
    expect(durableWorkspace).toContain("grant select on table public.workspace_snapshots to authenticated");
    expect(durableWorkspace).toContain("revoke all on table public.workspace_snapshots from anon, authenticated");
  });

  it("uses an authenticated compare-and-swap function for conflict-safe workspace saves", () => {
    expect(durableWorkspace).toContain("create function public.save_workspace_snapshot");
    expect(durableWorkspace).toContain("p_expected_revision bigint");
    expect(durableWorkspace).toContain("security invoker");
    expect(durableWorkspace).toContain("revision = p_expected_revision");
    expect(durableWorkspace).toContain("workspace revision conflict");
    expect(durableWorkspace).toContain("select auth.uid()");
    expect(durableWorkspace).toContain("revoke all on function public.save_workspace_snapshot");
    expect(durableWorkspace).toContain("grant execute on function public.save_workspace_snapshot");
  });
});
