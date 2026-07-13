-- Museboard production boundary. Designed for a new Supabase project.
-- Data API grants and RLS policies are intentionally separate and explicit.

create extension if not exists pgcrypto;
create schema if not exists private;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('pending', 'active', 'removed')),
  email_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create unique index one_active_owner_per_organization
  on public.organization_memberships (organization_id)
  where role = 'owner' and status = 'active';
create index memberships_by_user on public.organization_memberships (user_id, status);

create table public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  display_name text not null,
  audience text not null default '',
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  evidence jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.opportunities add constraint opportunities_id_org_unique unique (id, organization_id);
create index opportunities_by_org on public.opportunities (organization_id, created_at desc);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  title text not null,
  platform text not null,
  stage text not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_items add constraint content_items_id_org_unique unique (id, organization_id);
alter table public.content_items add constraint content_items_opportunity_org_fk
  foreign key (opportunity_id, organization_id) references public.opportunities(id, organization_id) on delete set null (opportunity_id);
create index content_items_by_org on public.content_items (organization_id, updated_at desc);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  payload jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (content_id, version_number)
);
alter table public.content_versions add constraint content_versions_id_org_unique unique (id, organization_id);
alter table public.content_versions add constraint content_versions_content_org_fk
  foreign key (content_id, organization_id) references public.content_items(id, organization_id) on delete cascade;
alter table public.content_items
  add constraint content_items_current_version_fk
  foreign key (current_version_id) references public.content_versions(id) on delete set null;
alter table public.content_items add constraint content_items_current_version_org_fk
  foreign key (current_version_id, organization_id) references public.content_versions(id, organization_id) on delete set null (current_version_id);
create index content_versions_by_content on public.content_versions (content_id, version_number desc);

create table public.planner_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_id uuid references public.content_items(id) on delete cascade,
  title text not null,
  stage text not null,
  status text not null check (status in ('planned', 'in_progress', 'done', 'missed', 'cancelled')),
  scheduled_for timestamptz,
  due_at timestamptz,
  timezone text not null,
  estimated_minutes integer not null check (estimated_minutes > 0 and estimated_minutes % 15 = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.planner_tasks add constraint planner_tasks_content_org_fk
  foreign key (content_id, organization_id) references public.content_items(id, organization_id) on delete cascade;
create index planner_tasks_by_org_time on public.planner_tasks (organization_id, scheduled_for);

create table public.collaboration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_id uuid references public.content_items(id) on delete cascade,
  content_version_id uuid references public.content_versions(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.collaboration_events add constraint collaboration_content_org_fk
  foreign key (content_id, organization_id) references public.content_items(id, organization_id) on delete cascade;
alter table public.collaboration_events add constraint collaboration_version_org_fk
  foreign key (content_version_id, organization_id) references public.content_versions(id, organization_id) on delete restrict;
create index collaboration_events_by_org on public.collaboration_events (organization_id, created_at desc);

create table public.export_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  content_version_id uuid not null references public.content_versions(id) on delete restrict,
  platform text not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.export_records add constraint export_records_id_org_unique unique (id, organization_id);
alter table public.export_records add constraint export_content_org_fk
  foreign key (content_id, organization_id) references public.content_items(id, organization_id) on delete cascade;
alter table public.export_records add constraint export_version_org_fk
  foreign key (content_version_id, organization_id) references public.content_versions(id, organization_id) on delete restrict;
create index export_records_by_org on public.export_records (organization_id, created_at desc);

create table public.publish_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  export_record_id uuid not null references public.export_records(id) on delete restrict,
  post_url text not null check (post_url ~ '^https://'),
  platform text not null,
  published_at timestamptz not null,
  verification_status text not null default 'manual_unverified' check (verification_status = 'manual_unverified'),
  created_at timestamptz not null default now(),
  unique (organization_id, platform, post_url)
);
alter table public.publish_receipts add constraint publish_receipts_id_org_unique unique (id, organization_id);
alter table public.publish_receipts add constraint receipt_export_org_fk
  foreign key (export_record_id, organization_id) references public.export_records(id, organization_id) on delete restrict;

create table public.metric_samples (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  publish_receipt_id uuid not null references public.publish_receipts(id) on delete cascade,
  platform text not null,
  metric_key text not null,
  metric_value numeric not null check (metric_value >= 0),
  metric_unit text not null,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null check (window_ended_at >= window_started_at),
  source_timezone text not null,
  imported_at timestamptz not null default now(),
  unique (publish_receipt_id, metric_key, window_started_at, window_ended_at)
);
alter table public.metric_samples add constraint metric_receipt_org_fk
  foreign key (publish_receipt_id, organization_id) references public.publish_receipts(id, organization_id) on delete cascade;
create index metric_samples_by_org on public.metric_samples (organization_id, imported_at desc);

create table public.billing_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  stripe_customer_id text not null unique,
  source_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_entitlements (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  stripe_price_id text not null,
  stripe_status text not null,
  plan text not null check (plan in ('creator', 'pro', 'studio')),
  active_until timestamptz,
  grace_started_at timestamptz,
  grace_ends_at timestamptz,
  source_event_created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entitlement text not null,
  operation text not null check (operation in ('reserve', 'commit', 'release')),
  amount integer not null check (amount > 0),
  idempotency_key text not null,
  period_started_at timestamptz not null,
  period_ended_at timestamptz not null check (period_ended_at > period_started_at),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index usage_ledger_by_org_period on public.usage_ledger (organization_id, period_started_at, entitlement);

create table private.stripe_events (
  event_id text primary key,
  event_type text not null,
  event_created_at timestamptz not null,
  status text not null check (status in ('processing', 'processed', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  failure_reason text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Membership helpers bypass membership RLS only after checking the authenticated user.
create function private.is_organization_member(p_organization_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and (p_roles is null or membership.role = any (p_roles))
  );
$$;

create function private.is_organization_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_organization_member(p_organization_id, array['owner']::text[]);
$$;

create function private.is_organization_path_member(p_organization_id text, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id::text = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and (p_roles is null or membership.role = any (p_roles))
  );
$$;

create function private.can_bootstrap_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.organizations organization
      where organization.id = p_organization_id
        and organization.created_by = (select auth.uid())
    )
    and not exists (
      select 1 from public.organization_memberships membership
      where membership.organization_id = p_organization_id
    );
$$;

revoke all on function private.is_organization_member(uuid, text[]) from public, anon, authenticated;
revoke all on function private.is_organization_owner(uuid) from public, anon, authenticated;
revoke all on function private.is_organization_path_member(text, text[]) from public, anon, authenticated;
revoke all on function private.can_bootstrap_organization(uuid) from public, anon, authenticated;
grant execute on function private.is_organization_member(uuid, text[]) to authenticated;
grant execute on function private.is_organization_owner(uuid) to authenticated;
grant execute on function private.is_organization_path_member(text, text[]) to authenticated;
grant execute on function private.can_bootstrap_organization(uuid) to authenticated;

-- Service-role-only RPCs give the webhook an idempotent, ordered projection boundary.
create function public.claim_stripe_event(
  p_event_id text,
  p_event_type text,
  p_created_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into private.stripe_events (event_id, event_type, event_created_at, status)
  values (p_event_id, p_event_type, p_created_at, 'processing')
  on conflict (event_id) do nothing;
  if found then return 'claimed'; end if;

  update private.stripe_events
  set status = 'processing', attempt_count = attempt_count + 1,
      failure_reason = null, received_at = now()
  where event_id = p_event_id
    and (
      status = 'failed'
      or (status = 'processing' and received_at < now() - interval '5 minutes')
    );
  if found then return 'claimed'; end if;
  return 'duplicate';
end;
$$;

create function public.mark_stripe_event_processed(p_event_id text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update private.stripe_events
  set status = 'processed', processed_at = now(), failure_reason = null
  where event_id = p_event_id;
$$;

create function public.mark_stripe_event_failed(p_event_id text, p_reason text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update private.stripe_events
  set status = 'failed', failure_reason = left(p_reason, 500)
  where event_id = p_event_id;
$$;

create function public.project_subscription_entitlement(
  p_organization_id uuid,
  p_subscription_id text,
  p_customer_id text,
  p_price_id text,
  p_status text,
  p_plan text,
  p_active_until timestamptz,
  p_grace_started_at timestamptz,
  p_grace_ends_at timestamptz,
  p_event_created_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_plan not in ('creator', 'pro', 'studio') then
    raise exception 'invalid Museboard plan';
  end if;

  insert into public.billing_accounts (organization_id, stripe_customer_id, source_event_created_at)
  values (p_organization_id, p_customer_id, p_event_created_at)
  on conflict (organization_id) do update
    set stripe_customer_id = excluded.stripe_customer_id,
        source_event_created_at = excluded.source_event_created_at,
        updated_at = now()
    where public.billing_accounts.source_event_created_at <= excluded.source_event_created_at;

  insert into public.subscription_entitlements (
    organization_id, stripe_subscription_id, stripe_customer_id, stripe_price_id,
    stripe_status, plan, active_until, grace_started_at, grace_ends_at,
    source_event_created_at
  ) values (
    p_organization_id, p_subscription_id, p_customer_id, p_price_id,
    p_status, p_plan, p_active_until, p_grace_started_at, p_grace_ends_at,
    p_event_created_at
  )
  on conflict (organization_id) do update set
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_price_id = excluded.stripe_price_id,
    stripe_status = excluded.stripe_status,
    plan = excluded.plan,
    active_until = excluded.active_until,
    grace_started_at = excluded.grace_started_at,
    grace_ends_at = excluded.grace_ends_at,
    source_event_created_at = excluded.source_event_created_at,
    updated_at = now()
  where public.subscription_entitlements.source_event_created_at <= excluded.source_event_created_at;
end;
$$;

revoke all on function public.claim_stripe_event(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_stripe_event_processed(text) from public, anon, authenticated;
revoke all on function public.mark_stripe_event_failed(text, text) from public, anon, authenticated;
revoke all on function public.project_subscription_entitlement(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_stripe_event(text, text, timestamptz) to service_role;
grant execute on function public.mark_stripe_event_processed(text) to service_role;
grant execute on function public.mark_stripe_event_failed(text, text) to service_role;
grant execute on function public.project_subscription_entitlement(uuid, text, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz) to service_role;

-- Adopt the new explicit-Data-API-grant model for future objects.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_memberships from anon, authenticated;
revoke all on table public.creator_profiles from anon, authenticated;
revoke all on table public.opportunities from anon, authenticated;
revoke all on table public.content_items from anon, authenticated;
revoke all on table public.content_versions from anon, authenticated;
revoke all on table public.planner_tasks from anon, authenticated;
revoke all on table public.collaboration_events from anon, authenticated;
revoke all on table public.export_records from anon, authenticated;
revoke all on table public.publish_receipts from anon, authenticated;
revoke all on table public.metric_samples from anon, authenticated;
revoke all on table public.billing_accounts from anon, authenticated;
revoke all on table public.subscription_entitlements from anon, authenticated;
revoke all on table public.usage_ledger from anon, authenticated;

grant select, insert, update, delete on table
  public.organizations,
  public.organization_memberships,
  public.creator_profiles,
  public.opportunities,
  public.content_items,
  public.planner_tasks,
  public.publish_receipts,
  public.metric_samples
to authenticated;
grant select, insert on table public.content_versions to authenticated;
grant select, insert, delete on table public.export_records to authenticated;
grant select, insert on table public.collaboration_events to authenticated;
grant select on table public.billing_accounts, public.subscription_entitlements, public.usage_ledger to authenticated;
grant all on all tables in schema public to service_role;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;
alter table public.creator_profiles enable row level security;
alter table public.creator_profiles force row level security;
alter table public.opportunities enable row level security;
alter table public.opportunities force row level security;
alter table public.content_items enable row level security;
alter table public.content_items force row level security;
alter table public.content_versions enable row level security;
alter table public.content_versions force row level security;
alter table public.planner_tasks enable row level security;
alter table public.planner_tasks force row level security;
alter table public.collaboration_events enable row level security;
alter table public.collaboration_events force row level security;
alter table public.export_records enable row level security;
alter table public.export_records force row level security;
alter table public.publish_receipts enable row level security;
alter table public.publish_receipts force row level security;
alter table public.metric_samples enable row level security;
alter table public.metric_samples force row level security;
alter table public.billing_accounts enable row level security;
alter table public.billing_accounts force row level security;
alter table public.subscription_entitlements enable row level security;
alter table public.subscription_entitlements force row level security;
alter table public.usage_ledger enable row level security;
alter table public.usage_ledger force row level security;

create policy "organizations select" on public.organizations for select to authenticated
  using (private.is_organization_member(id) or private.can_bootstrap_organization(id));
create policy "organizations insert" on public.organizations for insert to authenticated
  with check ((select auth.uid()) = created_by);
create policy "organizations update" on public.organizations for update to authenticated
  using (private.is_organization_owner(id)) with check (private.is_organization_owner(id));
create policy "organizations delete" on public.organizations for delete to authenticated
  using (private.is_organization_owner(id));

create policy "memberships select" on public.organization_memberships for select to authenticated
  using (private.is_organization_member(organization_id));
create policy "memberships insert" on public.organization_memberships for insert to authenticated
  with check (
    private.is_organization_owner(organization_id)
    or (user_id = (select auth.uid()) and role = 'owner' and status = 'active'
      and private.can_bootstrap_organization(organization_id))
  );
create policy "memberships update" on public.organization_memberships for update to authenticated
  using (private.is_organization_owner(organization_id))
  with check (private.is_organization_owner(organization_id));
create policy "memberships delete" on public.organization_memberships for delete to authenticated
  using (private.is_organization_owner(organization_id));

create policy "creator profiles select" on public.creator_profiles for select to authenticated using (private.is_organization_member(organization_id));
create policy "creator profiles insert" on public.creator_profiles for insert to authenticated with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "creator profiles update" on public.creator_profiles for update to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor'])) with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "creator profiles delete" on public.creator_profiles for delete to authenticated using (private.is_organization_owner(organization_id));

create policy "opportunities select" on public.opportunities for select to authenticated using (private.is_organization_member(organization_id));
create policy "opportunities insert" on public.opportunities for insert to authenticated with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "opportunities update" on public.opportunities for update to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor'])) with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "opportunities delete" on public.opportunities for delete to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor']));

create policy "content items select" on public.content_items for select to authenticated using (private.is_organization_member(organization_id));
create policy "content items insert" on public.content_items for insert to authenticated with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "content items update" on public.content_items for update to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor'])) with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "content items delete" on public.content_items for delete to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor']));

create policy "content versions select" on public.content_versions for select to authenticated using (private.is_organization_member(organization_id));
create policy "content versions insert" on public.content_versions for insert to authenticated with check (private.is_organization_member(organization_id, array['owner', 'editor']) and created_by = (select auth.uid()));
create policy "content versions update" on public.content_versions for update to authenticated using (false) with check (false);
create policy "content versions delete" on public.content_versions for delete to authenticated using (false);

create policy "planner tasks select" on public.planner_tasks for select to authenticated using (private.is_organization_member(organization_id));
create policy "planner tasks insert" on public.planner_tasks for insert to authenticated with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "planner tasks update" on public.planner_tasks for update to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor'])) with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "planner tasks delete" on public.planner_tasks for delete to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor']));

create policy "collaboration events select" on public.collaboration_events for select to authenticated using (private.is_organization_member(organization_id));
create policy "collaboration events insert" on public.collaboration_events for insert to authenticated with check (private.is_organization_member(organization_id, array['owner', 'editor']) and actor_user_id = (select auth.uid()));

create policy "export records select" on public.export_records for select to authenticated using (private.is_organization_member(organization_id));
create policy "export records insert" on public.export_records for insert to authenticated with check (private.is_organization_member(organization_id, array['owner', 'editor']) and created_by = (select auth.uid()));
create policy "export records update" on public.export_records for update to authenticated using (false) with check (false);
create policy "export records delete" on public.export_records for delete to authenticated using (private.is_organization_owner(organization_id));

create policy "publish receipts select" on public.publish_receipts for select to authenticated using (private.is_organization_member(organization_id));
create policy "publish receipts insert" on public.publish_receipts for insert to authenticated with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "publish receipts update" on public.publish_receipts for update to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor'])) with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "publish receipts delete" on public.publish_receipts for delete to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor']));

create policy "metric samples select" on public.metric_samples for select to authenticated using (private.is_organization_member(organization_id));
create policy "metric samples insert" on public.metric_samples for insert to authenticated with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "metric samples update" on public.metric_samples for update to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor'])) with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "metric samples delete" on public.metric_samples for delete to authenticated using (private.is_organization_member(organization_id, array['owner', 'editor']));

create policy "billing accounts select" on public.billing_accounts for select to authenticated using (private.is_organization_owner(organization_id));
create policy "subscription entitlements select" on public.subscription_entitlements for select to authenticated using (private.is_organization_member(organization_id));
create policy "usage ledger select" on public.usage_ledger for select to authenticated using (private.is_organization_member(organization_id));

-- Private creator uploads use organization-prefixed object names: <org uuid>/<asset id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('museboard-assets', 'museboard-assets', false, 262144000)
on conflict (id) do update set public = false, file_size_limit = 262144000;

create policy "assets select" on storage.objects for select to authenticated
  using (bucket_id = 'museboard-assets' and private.is_organization_path_member((storage.foldername(name))[1]));
create policy "assets insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'museboard-assets' and private.is_organization_path_member((storage.foldername(name))[1], array['owner', 'editor']));
create policy "assets update" on storage.objects for update to authenticated
  using (bucket_id = 'museboard-assets' and private.is_organization_path_member((storage.foldername(name))[1], array['owner', 'editor']))
  with check (bucket_id = 'museboard-assets' and private.is_organization_path_member((storage.foldername(name))[1], array['owner', 'editor']));
create policy "assets delete" on storage.objects for delete to authenticated
  using (bucket_id = 'museboard-assets' and private.is_organization_path_member((storage.foldername(name))[1], array['owner', 'editor']));
