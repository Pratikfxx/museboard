-- Ephemeral live presence and claimed, versioned contribution edits.
create table private.thinking_room_presence (
  organization_id uuid not null,
  room_id uuid not null,
  actor_user_id uuid not null,
  session_id uuid not null,
  display_name_snapshot text not null check (char_length(display_name_snapshot) between 1 and 160),
  area text not null check (area in ('room', 'audience_tensions', 'evidence', 'challenges', 'possibilities', 'synthesis')),
  is_composing boolean not null default false,
  expires_at timestamptz not null,
  primary key (organization_id, room_id, actor_user_id, session_id),
  foreign key (room_id, organization_id) references public.thinking_rooms(id, organization_id) on delete cascade,
  foreign key (organization_id, actor_user_id) references public.organization_memberships(organization_id, user_id) on delete cascade
);

create table private.thinking_contribution_edit_claims (
  organization_id uuid not null,
  room_id uuid not null,
  contribution_id uuid not null,
  actor_user_id uuid not null,
  session_id uuid not null,
  display_name_snapshot text not null check (char_length(display_name_snapshot) between 1 and 160),
  expires_at timestamptz not null,
  primary key (organization_id, room_id, contribution_id),
  constraint thinking_edit_claim_contribution_fk foreign key (contribution_id, room_id, organization_id)
    references public.thinking_contributions(id, room_id, organization_id)
    deferrable initially deferred,
  foreign key (organization_id, actor_user_id)
    references public.organization_memberships(organization_id, user_id) on delete cascade
);

create index thinking_room_presence_expiry on private.thinking_room_presence (expires_at);
create index thinking_contribution_edit_claims_expiry on private.thinking_contribution_edit_claims (expires_at);

create table public.thinking_contribution_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  room_id uuid not null,
  contribution_id uuid not null,
  revision bigint not null check (revision > 0),
  body text not null check (char_length(body) between 1 and 20000),
  source_reference_id text check (source_reference_id is null or char_length(source_reference_id) <= 2000),
  edited_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, contribution_id, revision),
  constraint thinking_version_contribution_fk foreign key (contribution_id, room_id, organization_id)
    references public.thinking_contributions(id, room_id, organization_id)
    deferrable initially deferred,
  foreign key (organization_id, edited_by_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict
);

revoke all on table private.thinking_room_presence from public, anon, authenticated;
revoke all on table private.thinking_contribution_edit_claims from public, anon, authenticated;
revoke all on table public.thinking_contribution_versions from public, anon, authenticated;
grant select, insert on table public.thinking_contribution_versions to service_role;
alter table public.thinking_contribution_versions enable row level security;
alter table public.thinking_contribution_versions force row level security;

create function private.reject_thinking_contribution_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'thinking contribution versions are immutable' using errcode = '42501';
end;
$$;
create trigger thinking_contribution_versions_immutable
before update or delete on public.thinking_contribution_versions
for each row execute function private.reject_thinking_contribution_version_mutation();
revoke all on function private.reject_thinking_contribution_version_mutation() from public, anon, authenticated;

create function private.thinking_room_actor_name(p_organization_id uuid, p_user_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  with active_members as (
    select membership.*,
      row_number() over (order by membership.created_at, membership.user_id) as collaborator_number
    from public.organization_memberships membership
    where membership.organization_id = p_organization_id and membership.status = 'active'
  )
  select left(coalesce(
    nullif(btrim(user_record.raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(user_record.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(user_record.raw_user_meta_data->>'name'), ''),
    case when membership.role = 'owner' then nullif(btrim(profile.display_name), '') end,
    'Collaborator ' || membership.collaborator_number::text
  ), 160)
  from active_members membership
  join auth.users user_record on user_record.id = membership.user_id
  left join public.creator_profiles profile on profile.organization_id = membership.organization_id
  where membership.organization_id = p_organization_id
    and membership.user_id = p_user_id
    and membership.status = 'active'
$$;
revoke all on function private.thinking_room_actor_name(uuid, uuid) from public, anon, authenticated;

create function private.cleanup_thinking_room_collaboration()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.thinking_room_presence presence
  where presence.expires_at <= now() or not exists (
      select 1 from public.organization_memberships membership
      where membership.organization_id = presence.organization_id
        and membership.user_id = presence.actor_user_id and membership.status = 'active'
    );
  delete from private.thinking_contribution_edit_claims claim
  where claim.expires_at <= now() or not exists (
      select 1 from public.organization_memberships membership
      where membership.organization_id = claim.organization_id
        and membership.user_id = claim.actor_user_id and membership.status = 'active'
    );
end;
$$;
revoke all on function private.cleanup_thinking_room_collaboration() from public, anon, authenticated;
grant execute on function private.cleanup_thinking_room_collaboration() to service_role;
-- Run private.cleanup_thinking_room_collaboration() from a Supabase scheduled function or pg_cron
-- when available. Every heartbeat and claim also performs this global cleanup opportunistically.

create function public.sync_thinking_room_presence(
  p_organization_id uuid, p_room_id uuid, p_session_id uuid, p_area text, p_is_composing boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_display_name text;
begin
  if v_user_id is null or not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = p_organization_id and membership.user_id = v_user_id and membership.status = 'active'
  ) then raise exception 'thinking room presence permission denied' using errcode = '42501'; end if;
  if p_area not in ('room', 'audience_tensions', 'evidence', 'challenges', 'possibilities', 'synthesis')
    or not exists (select 1 from public.thinking_rooms room where room.id = p_room_id and room.organization_id = p_organization_id)
  then raise exception 'thinking room not found' using errcode = '23503'; end if;
  v_display_name := private.thinking_room_actor_name(p_organization_id, v_user_id);
  perform private.cleanup_thinking_room_collaboration();
  insert into private.thinking_room_presence (
    organization_id, room_id, actor_user_id, session_id, display_name_snapshot, area, is_composing, expires_at
  ) values (p_organization_id, p_room_id, v_user_id, p_session_id, v_display_name, p_area, p_is_composing, now() + interval '30 seconds')
  on conflict (organization_id, room_id, actor_user_id, session_id) do update
    set display_name_snapshot = excluded.display_name_snapshot, area = excluded.area,
        is_composing = excluded.is_composing, expires_at = excluded.expires_at;
  return jsonb_build_object(
    'presence', coalesce((select jsonb_agg(jsonb_build_object(
      'actor_user_id', actor_user_id, 'display_name', display_name_snapshot,
      'area', area, 'is_composing', is_composing, 'expires_at', expires_at
    ) order by display_name_snapshot) from private.thinking_room_presence
      where organization_id = p_organization_id and room_id = p_room_id), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(jsonb_build_object(
      'contribution_id', contribution_id, 'actor_user_id', actor_user_id,
      'display_name', display_name_snapshot, 'expires_at', expires_at
    )) from private.thinking_contribution_edit_claims
      where organization_id = p_organization_id and room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

create function public.set_thinking_contribution_edit_claim(
  p_organization_id uuid, p_room_id uuid, p_contribution_id uuid, p_session_id uuid, p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_display_name text;
  v_claim private.thinking_contribution_edit_claims%rowtype;
begin
  select role into v_role from public.organization_memberships
  where organization_id = p_organization_id and user_id = v_user_id and status = 'active';
  if v_user_id is null or v_role not in ('owner', 'editor') then
    raise exception 'thinking room edit permission denied' using errcode = '42501';
  end if;
  if not exists (select 1 from public.thinking_rooms where id = p_room_id and organization_id = p_organization_id and status in ('exploring', 'synthesizing'))
    or not exists (select 1 from public.thinking_contributions where id = p_contribution_id and room_id = p_room_id and organization_id = p_organization_id)
  then raise exception 'thinking room contribution not found' using errcode = '23503'; end if;
  if not exists (select 1 from public.thinking_contributions where id = p_contribution_id and author_user_id = v_user_id) then
    raise exception 'only the original author may edit a contribution' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_contribution_id::text, 0));
  perform private.cleanup_thinking_room_collaboration();
  if not p_active then
    delete from private.thinking_contribution_edit_claims
    where organization_id = p_organization_id and room_id = p_room_id and contribution_id = p_contribution_id
      and actor_user_id = v_user_id and session_id = p_session_id;
    return 'null'::jsonb;
  end if;
  v_display_name := private.thinking_room_actor_name(p_organization_id, v_user_id);
  insert into private.thinking_contribution_edit_claims (
    organization_id, room_id, contribution_id, actor_user_id, session_id, display_name_snapshot, expires_at
  ) values (p_organization_id, p_room_id, p_contribution_id, v_user_id, p_session_id, v_display_name, now() + interval '45 seconds')
  on conflict (organization_id, room_id, contribution_id) do update
    set display_name_snapshot = excluded.display_name_snapshot, expires_at = excluded.expires_at
    where thinking_contribution_edit_claims.actor_user_id = excluded.actor_user_id
      and thinking_contribution_edit_claims.session_id = excluded.session_id
  returning * into v_claim;
  if not found or v_claim.actor_user_id <> v_user_id or v_claim.session_id <> p_session_id then
    raise exception 'contribution edit claim conflict' using errcode = '40001';
  end if;
  return jsonb_build_object('contribution_id', v_claim.contribution_id, 'actor_user_id', v_claim.actor_user_id,
    'display_name', v_claim.display_name_snapshot, 'expires_at', v_claim.expires_at);
end;
$$;

create function public.leave_thinking_room_presence(p_organization_id uuid, p_room_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  delete from private.thinking_room_presence where organization_id = p_organization_id and room_id = p_room_id and actor_user_id = v_user_id and session_id = p_session_id;
  delete from private.thinking_contribution_edit_claims where organization_id = p_organization_id and room_id = p_room_id and actor_user_id = v_user_id and session_id = p_session_id;
end;
$$;

create function public.edit_thinking_contribution(
  p_organization_id uuid, p_room_id uuid, p_contribution_id uuid, p_session_id uuid,
  p_expected_revision bigint, p_body text, p_source_reference_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_contribution public.thinking_contributions%rowtype;
  v_room_revision bigint;
begin
  select role into v_role from public.organization_memberships
  where organization_id = p_organization_id and user_id = v_user_id and status = 'active';
  if v_user_id is null or v_role not in ('owner', 'editor') then raise exception 'thinking room edit permission denied' using errcode = '42501'; end if;
  select contribution.* into v_contribution from public.thinking_contributions contribution
  join public.thinking_rooms room on room.id = contribution.room_id and room.organization_id = contribution.organization_id
  where contribution.id = p_contribution_id and contribution.room_id = p_room_id and contribution.organization_id = p_organization_id
    and room.status in ('exploring', 'synthesizing') for update of contribution;
  if not found then raise exception 'thinking room contribution not found' using errcode = '23503'; end if;
  if v_contribution.author_user_id <> v_user_id then raise exception 'only the original author may edit a contribution' using errcode = '42501'; end if;
  if not exists (select 1 from private.thinking_contribution_edit_claims claim
    where claim.organization_id = p_organization_id and claim.room_id = p_room_id and claim.contribution_id = p_contribution_id
      and claim.actor_user_id = v_user_id and claim.session_id = p_session_id and claim.expires_at > now())
  then raise exception 'contribution edit claim required' using errcode = '42501'; end if;
  if v_contribution.revision <> p_expected_revision then raise exception 'contribution revision conflict' using errcode = '40001'; end if;
  if nullif(btrim(p_body), '') is null
    or char_length(p_source_reference_id) > 2000
    or (v_contribution.lens = 'evidence' and nullif(btrim(p_source_reference_id), '') is null)
  then raise exception 'invalid contribution edit' using errcode = '23514'; end if;
  insert into public.thinking_contribution_versions (
    organization_id, room_id, contribution_id, revision, body, source_reference_id, edited_by_user_id, created_at
  ) values (p_organization_id, p_room_id, p_contribution_id, v_contribution.revision,
    v_contribution.body, v_contribution.source_reference_id, v_user_id, now());
  update public.thinking_contributions set body = btrim(p_body), source_reference_id = p_source_reference_id,
    revision = revision + 1, updated_at = now() where id = p_contribution_id returning * into v_contribution;
  update public.thinking_rooms set revision = revision + 1, updated_at = now()
    where id = p_room_id and organization_id = p_organization_id returning revision into v_room_revision;
  delete from private.thinking_contribution_edit_claims where organization_id = p_organization_id and room_id = p_room_id and contribution_id = p_contribution_id;
  return jsonb_build_object('room_revision', v_room_revision, 'contribution', jsonb_build_object(
    'id', v_contribution.id, 'room_id', v_contribution.room_id, 'lens', v_contribution.lens,
    'body', v_contribution.body, 'author_user_id', v_contribution.author_user_id,
    'author_display_name_snapshot', v_contribution.author_display_name_snapshot,
    'source_reference_id', v_contribution.source_reference_id, 'revision', v_contribution.revision,
    'created_at', v_contribution.created_at, 'updated_at', v_contribution.updated_at
  ));
end;
$$;

-- Existing contribution content is immutable through aggregate save; the dedicated edit RPC owns revisions and history.
alter function public.save_thinking_room(uuid, uuid, bigint, jsonb, jsonb, jsonb, jsonb, jsonb)
  rename to save_thinking_room_aggregate_impl;
revoke all on function public.save_thinking_room_aggregate_impl(uuid, uuid, bigint, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- The legacy aggregate function rebuilds its child arrays. During this one guarded call,
-- preserve every existing contribution row so edit claims and immutable versions stay attached.
create function private.preserve_thinking_contribution_during_aggregate_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('museboard.preserve_thinking_contributions', true), 'off') <> 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    return null; -- keep the existing row and its edit claim/history in place
  end if;
  if exists (
    select 1 from public.thinking_contributions contribution
    where contribution.id = new.id
      and contribution.room_id = new.room_id
      and contribution.organization_id = new.organization_id
  ) then
    return null;
  end if;
  return new;
end;
$$;
create trigger preserve_thinking_contributions_during_aggregate_save
before insert or delete on public.thinking_contributions
for each row execute function private.preserve_thinking_contribution_during_aggregate_save();
revoke all on function private.preserve_thinking_contribution_during_aggregate_save() from public, anon, authenticated;

create function public.save_thinking_room(
  p_organization_id uuid, p_room_id uuid, p_expected_revision bigint, p_room jsonb,
  p_contributions jsonb, p_reactions jsonb, p_links jsonb, p_synthesis_revisions jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.thinking_contributions contribution
    join jsonb_to_recordset(p_contributions) as row(
      id uuid, lens text, body text, author_user_id uuid,
      author_display_name_snapshot text, source_reference_id text,
      mentioned_user_id uuid, related_contribution_id uuid, revision bigint,
      created_at timestamptz, updated_at timestamptz, deleted_at timestamptz
    ) on row.id = contribution.id
    where contribution.organization_id = p_organization_id and contribution.room_id = p_room_id
      and (
        row.lens is distinct from contribution.lens
        or row.body is distinct from contribution.body
        or row.author_user_id is distinct from contribution.author_user_id
        or row.author_display_name_snapshot is distinct from contribution.author_display_name_snapshot
        or row.source_reference_id is distinct from contribution.source_reference_id
        or row.mentioned_user_id is distinct from contribution.mentioned_user_id
        or row.related_contribution_id is distinct from contribution.related_contribution_id
        or row.revision is distinct from contribution.revision
        or row.created_at is distinct from contribution.created_at
        or row.updated_at is distinct from contribution.updated_at
        or row.deleted_at is distinct from contribution.deleted_at
      )
  ) then raise exception 'existing contribution content is immutable through aggregate save' using errcode = '42501'; end if;
  perform set_config('museboard.preserve_thinking_contributions', 'on', true);
  return public.save_thinking_room_aggregate_impl(p_organization_id, p_room_id, p_expected_revision,
    p_room, p_contributions, p_reactions, p_links, p_synthesis_revisions);
end;
$$;

revoke all on function public.sync_thinking_room_presence(uuid, uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.set_thinking_contribution_edit_claim(uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.leave_thinking_room_presence(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.edit_thinking_contribution(uuid, uuid, uuid, uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.save_thinking_room(uuid, uuid, bigint, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sync_thinking_room_presence(uuid, uuid, uuid, text, boolean) to authenticated;
grant execute on function public.set_thinking_contribution_edit_claim(uuid, uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.leave_thinking_room_presence(uuid, uuid, uuid) to authenticated;
grant execute on function public.edit_thinking_contribution(uuid, uuid, uuid, uuid, bigint, text, text) to authenticated;
grant execute on function public.save_thinking_room(uuid, uuid, bigint, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
