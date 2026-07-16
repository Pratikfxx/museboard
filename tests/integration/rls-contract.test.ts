import { existsSync, readFileSync } from "node:fs";
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
const thinkingRooms = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260716090000_thinking_rooms.sql"),
  "utf8",
).toLowerCase();
const presenceEditsPath = resolve(
  process.cwd(),
  "supabase/migrations/20260716193000_thinking_room_presence_edits.sql",
);
const presenceEdits = existsSync(presenceEditsPath)
  ? readFileSync(presenceEditsPath, "utf8").toLowerCase()
  : "";

describe("production database boundary", () => {
  it("keeps live presence ephemeral and contribution editing behind authenticated RPCs", () => {
    expect(existsSync(presenceEditsPath)).toBe(true);
    expect(presenceEdits).toContain("create table private.thinking_room_presence");
    expect(presenceEdits).toContain("create table private.thinking_contribution_edit_claims");
    expect(presenceEdits).toContain("create table public.thinking_contribution_versions");
    expect(presenceEdits).toContain("create function public.sync_thinking_room_presence");
    expect(presenceEdits).toContain("create function public.set_thinking_contribution_edit_claim");
    expect(presenceEdits).toContain("create function public.leave_thinking_room_presence");
    expect(presenceEdits).toContain("create function public.edit_thinking_contribution");
    expect(presenceEdits).toContain("select auth.uid()");
    expect(presenceEdits).toContain("security definer");
    expect(presenceEdits).toContain("set search_path = ''");
    expect(presenceEdits).toContain("interval '30 seconds'");
    expect(presenceEdits).toContain("interval '45 seconds'");
    expect(presenceEdits).toContain("original author");
    expect(presenceEdits).toContain("contribution revision conflict");
    expect(presenceEdits).toContain("revoke all on table public.thinking_contribution_versions from public, anon, authenticated");
    expect(presenceEdits).not.toContain("grant select on table private.thinking_room_presence");
    expect(presenceEdits).toContain("existing contribution content is immutable through aggregate save");
    expect(presenceEdits).toContain("pg_advisory_xact_lock");
    expect(presenceEdits).toContain("thinking contribution versions are immutable");
    expect(presenceEdits).toContain("before update or delete on public.thinking_contribution_versions");
    expect(presenceEdits).toContain("deferrable initially deferred");
    expect(presenceEdits).toContain("create trigger preserve_thinking_contributions_during_aggregate_save");
    expect(presenceEdits).toContain("set_config('museboard.preserve_thinking_contributions', 'on', true)");
    expect(presenceEdits).toContain("coalesce(current_setting('museboard.preserve_thinking_contributions', true), 'off') <> 'on'");
    expect(presenceEdits).toContain("return null; -- keep the existing row and its edit claim/history in place");
    expect(presenceEdits).toContain("create index thinking_room_presence_expiry");
    expect(presenceEdits).toContain("create function private.cleanup_thinking_room_collaboration()");
    expect(presenceEdits).toContain("create function private.cleanup_thinking_room_collaboration_room");
    expect(presenceEdits).toContain("create extension if not exists pg_cron");
    expect(presenceEdits).toContain("museboard-thinking-room-collaboration-cleanup");
    expect(presenceEdits).toContain("perform private.cleanup_thinking_room_collaboration_room(p_organization_id, p_room_id)");
    expect(presenceEdits).not.toContain("perform private.cleanup_thinking_room_collaboration();");
    expect(presenceEdits).toContain("alter table public.thinking_contribution_versions enable row level security");
    expect(presenceEdits).toContain("alter table public.thinking_contribution_versions force row level security");
    expect(presenceEdits).toContain("char_length(p_source_reference_id) > 2000");
    expect(presenceEdits).not.toContain("references public.thinking_contributions(id, room_id, organization_id) on delete cascade");
    expect(presenceEdits).not.toContain("split_part(coalesce(user_record.email");
    for (const field of [
      "row.lens is distinct from contribution.lens",
      "row.body is distinct from contribution.body",
      "row.source_reference_id is distinct from contribution.source_reference_id",
      "row.mentioned_user_id is distinct from contribution.mentioned_user_id",
      "row.related_contribution_id is distinct from contribution.related_contribution_id",
      "row.revision is distinct from contribution.revision",
      "row.updated_at is distinct from contribution.updated_at",
      "row.deleted_at is distinct from contribution.deleted_at",
    ]) expect(presenceEdits).toContain(field);

    const wrapperStart = presenceEdits.indexOf("create function public.save_thinking_room(\n");
    const wrapperRevisionConflict = presenceEdits.indexOf("thinking room revision conflict", wrapperStart);
    const wrapperSemanticCheck = presenceEdits.indexOf("existing contribution content is immutable through aggregate save", wrapperStart);
    expect(wrapperStart).toBeGreaterThan(-1);
    expect(wrapperRevisionConflict).toBeGreaterThan(wrapperStart);
    expect(wrapperRevisionConflict).toBeLessThan(wrapperSemanticCheck);

    const editStart = presenceEdits.indexOf("create function public.edit_thinking_contribution(");
    const roomLock = presenceEdits.indexOf("select room.revision into v_room_revision", editStart);
    const contributionLock = presenceEdits.indexOf("select contribution.* into v_contribution", editStart);
    expect(roomLock).toBeGreaterThan(editStart);
    expect(roomLock).toBeLessThan(contributionLock);
  });
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

  it("normalizes Thinking Rooms outside workspace snapshots with tenant-safe foreign keys", () => {
    for (const table of [
      "thinking_rooms",
      "thinking_contributions",
      "thinking_contribution_reactions",
      "thinking_contribution_links",
      "thinking_synthesis_revisions",
      "thinking_room_content_origins",
    ]) {
      expect(thinkingRooms).toContain(`create table public.${table}`);
      expect(thinkingRooms).toContain(`alter table public.${table} enable row level security`);
      expect(thinkingRooms).toContain(`alter table public.${table} force row level security`);
      expect(thinkingRooms).toContain(`revoke all on table public.${table} from anon, authenticated`);
      expect(thinkingRooms).toContain(`grant select on table public.${table} to authenticated`);
    }
    expect(thinkingRooms).toContain("thinking_contributions_room_org_fk");
    expect(thinkingRooms).toContain("thinking_reactions_contribution_room_org_fk");
    expect(thinkingRooms).toContain("thinking_links_from_contribution_room_org_fk");
    expect(thinkingRooms).toContain("thinking_links_to_contribution_room_org_fk");
    expect(thinkingRooms).toContain("thinking_synthesis_room_org_fk");
    expect(thinkingRooms).toContain("thinking_content_origins_synthesis_room_org_fk");
    expect(thinkingRooms).not.toContain("workspace_snapshots");
  });

  it("attributes durable room activity to Supabase users and snapshots author names", () => {
    expect(thinkingRooms).toContain("facilitator_user_id uuid not null");
    expect(thinkingRooms).toContain("author_user_id uuid not null");
    expect(thinkingRooms).toContain("author_display_name_snapshot text not null");
    expect(thinkingRooms).toContain("actor_user_id uuid not null");
    expect(thinkingRooms).toContain("created_by_user_id uuid not null");
    expect(thinkingRooms).toContain("references auth.users(id)");
    expect(thinkingRooms).not.toMatch(/member-[a-z0-9]/u);
  });

  it("allows active members to read while routing owner/editor writes through the guarded RPC", () => {
    expect(thinkingRooms).toContain("private.is_organization_member(organization_id)");
    expect(thinkingRooms).toContain("for select to authenticated");
    expect(thinkingRooms).toContain("v_role not in ('owner', 'editor')");
    expect(thinkingRooms).not.toContain("grant insert, update, delete on table public.thinking_rooms to authenticated");
  });

  it("exposes an authenticated room-scoped compare-and-swap save", () => {
    expect(thinkingRooms).toContain("create function public.save_thinking_room");
    expect(thinkingRooms).toContain("p_expected_revision bigint");
    expect(thinkingRooms).toContain("security definer");
    expect(thinkingRooms).toContain("revision = p_expected_revision");
    expect(thinkingRooms).toContain("thinking room revision conflict");
    expect(thinkingRooms).toContain("select auth.uid()");
    expect(thinkingRooms).toContain("revoke all on function public.save_thinking_room");
    expect(thinkingRooms).toContain("grant execute on function public.save_thinking_room");
  });

  it("locks down aggregate writes and enforces immutable attribution inside the atomic save", () => {
    expect(thinkingRooms).not.toContain(
      "grant insert, update, delete on table public.thinking",
    );
    expect(thinkingRooms).toContain("p_links jsonb");
    expect(thinkingRooms).toContain("for update");
    expect(thinkingRooms).toContain("only workspace owners may reassign thinking room owners");
    expect(thinkingRooms).toContain("contribution attribution is immutable");
    expect(thinkingRooms).toContain("v_author_display_name");
    expect(thinkingRooms).toContain("user_record.email");
    expect(thinkingRooms).toContain("profile.display_name");
    expect(thinkingRooms).toContain("row.author_display_name_snapshot is distinct from v_author_display_name");
    expect(thinkingRooms).toContain("editors must own their initial thinking room decision");
    expect(thinkingRooms).toContain("synthesis history is append-only");
    expect(thinkingRooms).toContain("reaction attribution is immutable");
    expect(thinkingRooms).toContain("contribution link history is append-only");
    expect(thinkingRooms).toContain("only the assigned decision owner may accept synthesis");
    expect(thinkingRooms).toContain("new contribution links must start open");
    expect(thinkingRooms).toMatch(/link\.id is null[\s\S]+row\.resolution_status <> 'open'/u);
    expect(thinkingRooms).toContain("v_existing_links");
    expect(thinkingRooms).toContain("existing->>'resolved_at'");
  });

  it("enforces evidence provenance, one accepted synthesis, and legal lifecycle transitions in SQL", () => {
    expect(thinkingRooms).toContain("constraint thinking_evidence_requires_source");
    expect(thinkingRooms).toContain("create unique index one_accepted_synthesis_per_thinking_room");
    expect(thinkingRooms).toContain("where status = 'accepted'");
    expect(thinkingRooms).toContain("invalid thinking room lifecycle transition");
    expect(thinkingRooms).toContain("reopen thinking room before mutation");
    expect(thinkingRooms).toContain("synthesis.status = 'accepted'");
    expect(thinkingRooms).toContain("row.status = 'superseded'");
    expect(thinkingRooms).toContain("newer.status = 'accepted' and newer.number > synthesis.number");
    expect(thinkingRooms).not.toContain("row.accepted_at is null");
    expect(thinkingRooms).toContain("initial thinking rooms must be exploring");
  });

  it("gives active viewers a narrow own-reaction RPC without reasoning-table writes", () => {
    expect(thinkingRooms).toContain("create function public.set_thinking_room_reaction");
    expect(thinkingRooms).toContain("v_user_id uuid := (select auth.uid())");
    expect(thinkingRooms).toContain("actor_user_id = v_user_id");
    expect(thinkingRooms).toContain("status = 'active'");
    expect(thinkingRooms).toContain("revision = revision + 1");
    expect(thinkingRooms).toContain("thinking room reactions require an active room");
    expect(thinkingRooms).toContain("grant execute on function public.set_thinking_room_reaction");
  });

  it("records immutable idempotent conversion per accepted synthesis", () => {
    expect(thinkingRooms).toContain("create table public.thinking_room_content_origins");
    expect(thinkingRooms).toContain("unique (organization_id, room_id, synthesis_revision_id)");
    expect(thinkingRooms).toContain("create function public.convert_thinking_room");
    expect(thinkingRooms).toContain("v_existing public.thinking_room_content_origins%rowtype");
    expect(thinkingRooms).toContain("status = 'accepted'");
    expect(thinkingRooms).toContain("decision_owner_user_id = synthesis.accepted_by_user_id");
    expect(thinkingRooms).toContain("thinking room conversion revision conflict");
    expect(thinkingRooms).toContain("insert into public.thinking_room_content_origins");
    expect(thinkingRooms).toContain("created_by_user_id, created_at");
    expect(thinkingRooms).toContain("values (p_organization_id, p_room_id, p_synthesis_revision_id, p_idea_id, v_user_id, now())");
    expect(thinkingRooms).toContain("create function private.prevent_thinking_content_origin_mutation");
    expect(thinkingRooms).toContain("before update or delete on public.thinking_room_content_origins");
    expect(thinkingRooms).toContain("grant select, insert on table public.thinking_room_content_origins to service_role");
    expect(thinkingRooms).not.toContain("grant all on table public.thinking_room_content_origins to service_role");
    expect(thinkingRooms).toContain("jsonb_array_length(v_direction->'evidencecontributionids')");
    expect(thinkingRooms).toContain("c.source_reference_id = evidence_reference.reference_id");
    expect(thinkingRooms).toContain("c.id::text = any (v_evidence_contribution_ids)");
    expect(thinkingRooms).toContain("grant execute on function public.convert_thinking_room");
    expect(thinkingRooms).not.toContain("grant insert, update, delete on table public.thinking_room_content_origins");
  });
});
