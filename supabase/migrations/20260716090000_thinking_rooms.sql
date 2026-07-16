-- Thinking Rooms are normalized, room-scoped collaborative records. They are
-- deliberately independent from the whole-workspace snapshot bridge.
create table public.thinking_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id text not null check (char_length(workspace_id) between 1 and 160),
  question text not null check (char_length(question) between 1 and 2000),
  template_id text not null check (char_length(template_id) between 1 and 120),
  status text not null check (status in ('exploring', 'synthesizing', 'decided', 'converted', 'archived')),
  facilitator_user_id uuid not null references auth.users(id) on delete restrict,
  decision_owner_user_id uuid references auth.users(id) on delete restrict,
  context text,
  decision_due_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, organization_id),
  foreign key (organization_id, facilitator_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (organization_id, decision_owner_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict
);
create index thinking_rooms_by_org on public.thinking_rooms (organization_id, updated_at desc);

create table public.thinking_contributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  room_id uuid not null,
  lens text not null check (lens in ('audience_tensions', 'evidence', 'challenges', 'possibilities')),
  body text not null check (char_length(body) between 1 and 20000),
  author_user_id uuid not null references auth.users(id) on delete restrict,
  author_display_name_snapshot text not null check (char_length(author_display_name_snapshot) between 1 and 160),
  source_reference_id text,
  mentioned_user_id uuid references auth.users(id) on delete restrict,
  related_contribution_id uuid,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, room_id, organization_id),
  constraint thinking_contributions_room_org_fk
    foreign key (room_id, organization_id)
    references public.thinking_rooms(id, organization_id) on delete cascade,
  foreign key (organization_id, author_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (organization_id, mentioned_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  constraint thinking_contributions_related_room_org_fk
    foreign key (related_contribution_id, room_id, organization_id)
    references public.thinking_contributions(id, room_id, organization_id)
    on delete set null (related_contribution_id)
    deferrable initially deferred
);
create index thinking_contributions_by_room
  on public.thinking_contributions (organization_id, room_id, created_at);

create table public.thinking_contribution_reactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  room_id uuid not null,
  contribution_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('agree', 'concern', 'needs_evidence', 'promising')),
  created_at timestamptz not null default now(),
  unique (organization_id, contribution_id, actor_user_id, kind),
  constraint thinking_reactions_contribution_room_org_fk
    foreign key (contribution_id, room_id, organization_id)
    references public.thinking_contributions(id, room_id, organization_id) on delete cascade,
  foreign key (organization_id, actor_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict
);
create index thinking_reactions_by_room
  on public.thinking_contribution_reactions (organization_id, room_id, created_at);

create table public.thinking_synthesis_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  room_id uuid not null,
  number integer not null check (number > 0),
  belief text not null check (char_length(belief) between 1 and 20000),
  unknowns jsonb not null default '[]'::jsonb check (jsonb_typeof(unknowns) = 'array'),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  chosen_direction jsonb not null check (jsonb_typeof(chosen_direction) = 'object'),
  open_challenge_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(open_challenge_ids) = 'array'),
  source_contribution_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(source_contribution_ids) = 'array'),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  generation_provenance jsonb,
  status text not null check (status in ('draft', 'proposed', 'accepted', 'superseded')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete restrict,
  unique (room_id, number),
  constraint thinking_synthesis_room_org_fk
    foreign key (room_id, organization_id)
    references public.thinking_rooms(id, organization_id) on delete cascade,
  foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (organization_id, accepted_by_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  check (
    (status = 'accepted' and accepted_at is not null and accepted_by_user_id is not null)
    or (status <> 'accepted' and accepted_at is null and accepted_by_user_id is null)
  )
);
create index thinking_synthesis_by_room
  on public.thinking_synthesis_revisions (organization_id, room_id, number);

revoke all on table public.thinking_rooms from anon, authenticated;
revoke all on table public.thinking_contributions from anon, authenticated;
revoke all on table public.thinking_contribution_reactions from anon, authenticated;
revoke all on table public.thinking_synthesis_revisions from anon, authenticated;

grant select on table public.thinking_rooms to authenticated;
grant select on table public.thinking_contributions to authenticated;
grant select on table public.thinking_contribution_reactions to authenticated;
grant select on table public.thinking_synthesis_revisions to authenticated;
grant insert, update, delete on table public.thinking_rooms to authenticated;
grant insert, update, delete on table public.thinking_contributions to authenticated;
grant insert, update, delete on table public.thinking_contribution_reactions to authenticated;
grant insert, update, delete on table public.thinking_synthesis_revisions to authenticated;
grant all on table public.thinking_rooms to service_role;
grant all on table public.thinking_contributions to service_role;
grant all on table public.thinking_contribution_reactions to service_role;
grant all on table public.thinking_synthesis_revisions to service_role;

alter table public.thinking_rooms enable row level security;
alter table public.thinking_rooms force row level security;
alter table public.thinking_contributions enable row level security;
alter table public.thinking_contributions force row level security;
alter table public.thinking_contribution_reactions enable row level security;
alter table public.thinking_contribution_reactions force row level security;
alter table public.thinking_synthesis_revisions enable row level security;
alter table public.thinking_synthesis_revisions force row level security;

create policy "thinking rooms select" on public.thinking_rooms
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "thinking rooms insert" on public.thinking_rooms
  for insert to authenticated with check (
    private.is_organization_member(organization_id, array['owner', 'editor'])
    and facilitator_user_id = (select auth.uid())
  );
create policy "thinking rooms update" on public.thinking_rooms
  for update to authenticated
  using (private.is_organization_member(organization_id, array['owner', 'editor']))
  with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "thinking rooms delete" on public.thinking_rooms
  for delete to authenticated
  using (private.is_organization_member(organization_id, array['owner', 'editor']));

create policy "thinking contributions select" on public.thinking_contributions
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "thinking contributions insert" on public.thinking_contributions
  for insert to authenticated with check (
    private.is_organization_member(organization_id, array['owner', 'editor'])
  );
create policy "thinking contributions update" on public.thinking_contributions
  for update to authenticated
  using (private.is_organization_member(organization_id, array['owner', 'editor']))
  with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "thinking contributions delete" on public.thinking_contributions
  for delete to authenticated
  using (private.is_organization_member(organization_id, array['owner', 'editor']));

create policy "thinking reactions select" on public.thinking_contribution_reactions
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "thinking reactions insert" on public.thinking_contribution_reactions
  for insert to authenticated with check (
    private.is_organization_member(organization_id, array['owner', 'editor'])
  );
create policy "thinking reactions update" on public.thinking_contribution_reactions
  for update to authenticated
  using (private.is_organization_member(organization_id, array['owner', 'editor']))
  with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "thinking reactions delete" on public.thinking_contribution_reactions
  for delete to authenticated
  using (private.is_organization_member(organization_id, array['owner', 'editor']));

create policy "thinking synthesis select" on public.thinking_synthesis_revisions
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "thinking synthesis insert" on public.thinking_synthesis_revisions
  for insert to authenticated with check (
    private.is_organization_member(organization_id, array['owner', 'editor'])
  );
create policy "thinking synthesis update" on public.thinking_synthesis_revisions
  for update to authenticated
  using (private.is_organization_member(organization_id, array['owner', 'editor']))
  with check (private.is_organization_member(organization_id, array['owner', 'editor']));
create policy "thinking synthesis delete" on public.thinking_synthesis_revisions
  for delete to authenticated
  using (private.is_organization_member(organization_id, array['owner', 'editor']));

-- Full-room compare-and-swap is the first live write boundary. It is scoped to
-- exactly one room and replaces only that room's normalized child records.
create function public.save_thinking_room(
  p_organization_id uuid,
  p_room_id uuid,
  p_expected_revision bigint,
  p_room jsonb,
  p_contributions jsonb,
  p_reactions jsonb,
  p_synthesis_revisions jsonb
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
  if p_expected_revision < 0
     or jsonb_typeof(p_room) <> 'object'
     or jsonb_typeof(p_contributions) <> 'array'
     or jsonb_typeof(p_reactions) <> 'array'
     or jsonb_typeof(p_synthesis_revisions) <> 'array' then
    raise exception 'invalid thinking room payload';
  end if;

  if p_expected_revision = 0 then
    insert into public.thinking_rooms (
      id, organization_id, workspace_id, question, template_id, status,
      facilitator_user_id, decision_owner_user_id, context, decision_due_at,
      revision, created_at, updated_at, archived_at
    ) values (
      p_room_id,
      p_organization_id,
      p_room->>'workspace_id',
      p_room->>'question',
      p_room->>'template_id',
      p_room->>'status',
      v_user_id,
      (p_room->>'decision_owner_user_id')::uuid,
      p_room->>'context',
      (p_room->>'decision_due_at')::timestamptz,
      1,
      (p_room->>'created_at')::timestamptz,
      (p_room->>'updated_at')::timestamptz,
      (p_room->>'archived_at')::timestamptz
    )
    on conflict (id) do nothing
    returning revision into v_revision;
  else
    update public.thinking_rooms
    set workspace_id = p_room->>'workspace_id',
        question = p_room->>'question',
        template_id = p_room->>'template_id',
        status = p_room->>'status',
        facilitator_user_id = (p_room->>'facilitator_user_id')::uuid,
        decision_owner_user_id = (p_room->>'decision_owner_user_id')::uuid,
        context = p_room->>'context',
        decision_due_at = (p_room->>'decision_due_at')::timestamptz,
        revision = revision + 1,
        updated_at = (p_room->>'updated_at')::timestamptz,
        archived_at = (p_room->>'archived_at')::timestamptz
    where id = p_room_id
      and organization_id = p_organization_id
      and revision = p_expected_revision
    returning revision into v_revision;
  end if;

  if v_revision is null then
    raise exception 'thinking room revision conflict' using errcode = '40001';
  end if;

  delete from public.thinking_contribution_reactions
    where organization_id = p_organization_id and room_id = p_room_id;
  delete from public.thinking_synthesis_revisions
    where organization_id = p_organization_id and room_id = p_room_id;
  delete from public.thinking_contributions
    where organization_id = p_organization_id and room_id = p_room_id;

  insert into public.thinking_contributions (
    id, organization_id, room_id, lens, body, author_user_id,
    author_display_name_snapshot, source_reference_id, mentioned_user_id,
    related_contribution_id, revision, created_at, updated_at, deleted_at
  )
  select
    row.id, p_organization_id, p_room_id, row.lens, row.body, row.author_user_id,
    row.author_display_name_snapshot, row.source_reference_id, row.mentioned_user_id,
    row.related_contribution_id, row.revision, row.created_at, row.updated_at, row.deleted_at
  from jsonb_to_recordset(p_contributions) as row(
    id uuid, lens text, body text, author_user_id uuid,
    author_display_name_snapshot text, source_reference_id text,
    mentioned_user_id uuid, related_contribution_id uuid, revision bigint,
    created_at timestamptz, updated_at timestamptz, deleted_at timestamptz
  );

  insert into public.thinking_contribution_reactions (
    id, organization_id, room_id, contribution_id, actor_user_id, kind, created_at
  )
  select row.id, p_organization_id, p_room_id, row.contribution_id,
    row.actor_user_id, row.kind, row.created_at
  from jsonb_to_recordset(p_reactions) as row(
    id uuid, contribution_id uuid, actor_user_id uuid, kind text, created_at timestamptz
  );

  insert into public.thinking_synthesis_revisions (
    id, organization_id, room_id, number, belief, unknowns, confidence,
    chosen_direction, open_challenge_ids, source_contribution_ids,
    created_by_user_id, generation_provenance, status, created_at,
    accepted_at, accepted_by_user_id
  )
  select row.id, p_organization_id, p_room_id, row.number, row.belief,
    row.unknowns, row.confidence, row.chosen_direction, row.open_challenge_ids,
    row.source_contribution_ids, row.created_by_user_id,
    row.generation_provenance, row.status, row.created_at,
    row.accepted_at, row.accepted_by_user_id
  from jsonb_to_recordset(p_synthesis_revisions) as row(
    id uuid, number integer, belief text, unknowns jsonb, confidence text,
    chosen_direction jsonb, open_challenge_ids jsonb,
    source_contribution_ids jsonb, created_by_user_id uuid,
    generation_provenance jsonb, status text, created_at timestamptz,
    accepted_at timestamptz, accepted_by_user_id uuid
  );

  if exists (
    select 1
    from public.thinking_synthesis_revisions revision,
      jsonb_array_elements_text(revision.open_challenge_ids) challenge_id
    where revision.organization_id = p_organization_id
      and revision.room_id = p_room_id
      and not exists (
        select 1 from public.thinking_contributions contribution
        where contribution.organization_id = p_organization_id
          and contribution.room_id = p_room_id
          and contribution.id = challenge_id::uuid
      )
  ) or exists (
    select 1
    from public.thinking_synthesis_revisions revision,
      jsonb_array_elements_text(revision.source_contribution_ids) source_id
    where revision.organization_id = p_organization_id
      and revision.room_id = p_room_id
      and not exists (
        select 1 from public.thinking_contributions contribution
        where contribution.organization_id = p_organization_id
          and contribution.room_id = p_room_id
          and contribution.id = source_id::uuid
      )
  ) then
    raise exception 'thinking room synthesis references another room';
  end if;

  return v_revision;
end;
$$;

revoke all on function public.save_thinking_room(uuid, uuid, bigint, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_thinking_room(uuid, uuid, bigint, jsonb, jsonb, jsonb, jsonb)
  to authenticated;
