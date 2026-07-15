-- A revisioned bridge that makes the complete creator workflow durable while
-- normalized collaborative repositories are introduced behind the same API.
create table public.workspace_snapshots (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version = 1),
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pg_column_size(payload) <= 5242880)
);

revoke all on table public.workspace_snapshots from anon, authenticated;
grant select on table public.workspace_snapshots to authenticated;
grant insert, update on table public.workspace_snapshots to authenticated;
grant all on table public.workspace_snapshots to service_role;

alter table public.workspace_snapshots enable row level security;
alter table public.workspace_snapshots force row level security;

create policy "workspace snapshots select"
  on public.workspace_snapshots for select to authenticated
  using (private.is_organization_member(organization_id));

create policy "workspace snapshots insert"
  on public.workspace_snapshots for insert to authenticated
  with check (
    private.is_organization_member(organization_id, array['owner', 'editor'])
    and updated_by = (select auth.uid())
  );

create policy "workspace snapshots update"
  on public.workspace_snapshots for update to authenticated
  using (private.is_organization_member(organization_id, array['owner', 'editor']))
  with check (
    private.is_organization_member(organization_id, array['owner', 'editor'])
    and updated_by = (select auth.uid())
  );

create function public.save_workspace_snapshot(
  p_organization_id uuid,
  p_expected_revision bigint,
  p_schema_version integer,
  p_payload jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_revision bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_expected_revision < 0 or p_schema_version <> 1 then
    raise exception 'invalid workspace snapshot';
  end if;

  if p_expected_revision = 0 then
    insert into public.workspace_snapshots (
      organization_id,
      schema_version,
      revision,
      payload,
      updated_by
    ) values (
      p_organization_id,
      p_schema_version,
      1,
      p_payload,
      v_user_id
    )
    on conflict (organization_id) do nothing
    returning revision into v_revision;
  else
    update public.workspace_snapshots
    set schema_version = p_schema_version,
        revision = revision + 1,
        payload = p_payload,
        updated_by = v_user_id,
        updated_at = now()
    where organization_id = p_organization_id
      and revision = p_expected_revision
    returning revision into v_revision;
  end if;

  if v_revision is null then
    raise exception 'workspace revision conflict' using errcode = '40001';
  end if;
  return v_revision;
end;
$$;

revoke all on function public.save_workspace_snapshot(uuid, bigint, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_workspace_snapshot(uuid, bigint, integer, jsonb)
  to authenticated;
