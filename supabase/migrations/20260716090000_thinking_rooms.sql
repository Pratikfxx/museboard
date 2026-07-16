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
  constraint thinking_evidence_requires_source check (
    lens <> 'evidence' or nullif(btrim(source_reference_id), '') is not null
  ),
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

create table public.thinking_contribution_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  room_id uuid not null,
  from_contribution_id uuid not null,
  to_contribution_id uuid not null,
  relationship text not null check (relationship in ('supports', 'challenges', 'extends', 'combines')),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  resolution_status text not null default 'open' check (resolution_status in ('open', 'resolved')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) between 1 and 20000),
  resolved_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (id, room_id, organization_id),
  constraint thinking_links_from_contribution_room_org_fk
    foreign key (from_contribution_id, room_id, organization_id)
    references public.thinking_contributions(id, room_id, organization_id) on delete restrict,
  constraint thinking_links_to_contribution_room_org_fk
    foreign key (to_contribution_id, room_id, organization_id)
    references public.thinking_contributions(id, room_id, organization_id) on delete restrict,
  foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (organization_id, resolved_by_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  check (
    (resolution_status = 'resolved' and resolution_note is not null and resolved_by_user_id is not null and resolved_at is not null)
    or (resolution_status = 'open' and resolution_note is null and resolved_by_user_id is null and resolved_at is null)
  )
);
create index thinking_links_by_room
  on public.thinking_contribution_links (organization_id, room_id, created_at);

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
  unique (id, room_id, organization_id),
  constraint thinking_synthesis_room_org_fk
    foreign key (room_id, organization_id)
    references public.thinking_rooms(id, organization_id) on delete cascade,
  foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (organization_id, accepted_by_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  check (
    (status in ('accepted', 'superseded') and accepted_at is not null and accepted_by_user_id is not null)
    or (status not in ('accepted', 'superseded') and accepted_at is null and accepted_by_user_id is null)
  )
);
create index thinking_synthesis_by_room
  on public.thinking_synthesis_revisions (organization_id, room_id, number);
create unique index one_accepted_synthesis_per_thinking_room
  on public.thinking_synthesis_revisions (organization_id, room_id)
  where status = 'accepted';

-- The conversion receipt is normalized and immutable. Idea Board content still
-- follows the existing revisioned workspace snapshot sync; this row is the
-- durable room-to-synthesis-to-idea identity and idempotency boundary.
create table public.thinking_room_content_origins (
  organization_id uuid not null,
  room_id uuid not null,
  synthesis_revision_id uuid not null,
  idea_id uuid not null unique,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, room_id, synthesis_revision_id),
  constraint thinking_content_origins_synthesis_room_org_fk
    foreign key (synthesis_revision_id, room_id, organization_id)
    references public.thinking_synthesis_revisions(id, room_id, organization_id)
    on delete no action deferrable initially deferred,
  foreign key (organization_id, created_by_user_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict
);
create index thinking_content_origins_by_room
  on public.thinking_room_content_origins (organization_id, room_id, created_at);

create function private.prevent_thinking_content_origin_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'thinking room content origins are immutable' using errcode = '42501';
end;
$$;
create trigger prevent_thinking_content_origin_mutation
  before update or delete on public.thinking_room_content_origins
  for each row execute function private.prevent_thinking_content_origin_mutation();
revoke all on function private.prevent_thinking_content_origin_mutation()
  from public, anon, authenticated, service_role;

revoke all on table public.thinking_rooms from anon, authenticated;
revoke all on table public.thinking_contributions from anon, authenticated;
revoke all on table public.thinking_contribution_reactions from anon, authenticated;
revoke all on table public.thinking_contribution_links from anon, authenticated;
revoke all on table public.thinking_synthesis_revisions from anon, authenticated;
revoke all on table public.thinking_room_content_origins from anon, authenticated;

grant select on table public.thinking_rooms to authenticated;
grant select on table public.thinking_contributions to authenticated;
grant select on table public.thinking_contribution_reactions to authenticated;
grant select on table public.thinking_contribution_links to authenticated;
grant select on table public.thinking_synthesis_revisions to authenticated;
grant select on table public.thinking_room_content_origins to authenticated;
grant all on table public.thinking_rooms to service_role;
grant all on table public.thinking_contributions to service_role;
grant all on table public.thinking_contribution_reactions to service_role;
grant all on table public.thinking_contribution_links to service_role;
grant all on table public.thinking_synthesis_revisions to service_role;
grant select, insert on table public.thinking_room_content_origins to service_role;

alter table public.thinking_rooms enable row level security;
alter table public.thinking_rooms force row level security;
alter table public.thinking_contributions enable row level security;
alter table public.thinking_contributions force row level security;
alter table public.thinking_contribution_reactions enable row level security;
alter table public.thinking_contribution_reactions force row level security;
alter table public.thinking_contribution_links enable row level security;
alter table public.thinking_contribution_links force row level security;
alter table public.thinking_synthesis_revisions enable row level security;
alter table public.thinking_synthesis_revisions force row level security;
alter table public.thinking_room_content_origins enable row level security;
alter table public.thinking_room_content_origins force row level security;

create policy "thinking rooms select" on public.thinking_rooms
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "thinking contributions select" on public.thinking_contributions
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "thinking reactions select" on public.thinking_contribution_reactions
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "thinking links select" on public.thinking_contribution_links
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "thinking synthesis select" on public.thinking_synthesis_revisions
  for select to authenticated using (private.is_organization_member(organization_id));
create policy "thinking content origins select" on public.thinking_room_content_origins
  for select to authenticated using (private.is_organization_member(organization_id));

-- This function is the sole full-room write boundary. SECURITY DEFINER is
-- intentional because authenticated users have no direct history-table DML;
-- every authorization and immutable-history rule is repeated atomically here.
create function public.save_thinking_room(
  p_organization_id uuid,
  p_room_id uuid,
  p_expected_revision bigint,
  p_room jsonb,
  p_contributions jsonb,
  p_reactions jsonb,
  p_links jsonb,
  p_synthesis_revisions jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_author_display_name text;
  v_revision bigint;
  v_room public.thinking_rooms%rowtype;
  v_existing_links jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select
    membership.role,
    left(
      coalesce(
        case when membership.role = 'owner' then profile.display_name end,
        nullif(split_part(coalesce(user_record.email, membership.email_snapshot, ''), '@', 1), ''),
        'Museboard collaborator'
      ),
      160
    )
  into v_role, v_author_display_name
  from public.organization_memberships membership
  join auth.users user_record on user_record.id = membership.user_id
  left join public.creator_profiles profile
    on profile.organization_id = membership.organization_id
  where membership.organization_id = p_organization_id
    and membership.user_id = v_user_id
    and membership.status = 'active';
  if v_role is null or v_role not in ('owner', 'editor') then
    raise exception 'thinking room write permission denied' using errcode = '42501';
  end if;
  if v_author_display_name is null then
    raise exception 'author display name is unavailable' using errcode = '23514';
  end if;
  if p_expected_revision < 0
     or jsonb_typeof(p_room) <> 'object'
     or jsonb_typeof(p_contributions) <> 'array'
     or jsonb_typeof(p_reactions) <> 'array'
     or jsonb_typeof(p_links) <> 'array'
     or jsonb_typeof(p_synthesis_revisions) <> 'array' then
    raise exception 'invalid thinking room payload' using errcode = '23514';
  end if;

  if p_expected_revision = 0 then
    if p_room->>'status' <> 'exploring' or (p_room->>'archived_at')::timestamptz is not null then
      raise exception 'initial Thinking Rooms must be exploring' using errcode = '23514';
    end if;
    if (p_room->>'facilitator_user_id')::uuid <> v_user_id then
      raise exception 'thinking room facilitator attribution is invalid' using errcode = '42501';
    end if;
    if v_role = 'editor' and (p_room->>'decision_owner_user_id')::uuid is distinct from v_user_id then
      raise exception 'editors must own their initial Thinking Room decision' using errcode = '42501';
    end if;
  else
    select room.* into v_room
    from public.thinking_rooms room
    where room.id = p_room_id
      and room.organization_id = p_organization_id
      and room.revision = p_expected_revision
    for update;
    if not found then
      raise exception 'thinking room revision conflict' using errcode = '40001';
    end if;
    if not (
      v_room.status = (p_room->>'status')
      or (v_room.status = 'exploring' and p_room->>'status' in ('synthesizing', 'archived'))
      or (v_room.status = 'synthesizing' and p_room->>'status' in ('decided', 'archived'))
      or (v_room.status = 'decided' and p_room->>'status' in ('converted', 'synthesizing', 'archived'))
      or (v_room.status = 'converted' and p_room->>'status' in ('synthesizing', 'archived'))
    ) then
      raise exception 'invalid thinking room lifecycle transition' using errcode = '23514';
    end if;
    if v_room.status in ('decided', 'converted', 'archived')
      and v_room.status = (p_room->>'status') then
      raise exception 'reopen thinking room before mutation' using errcode = '23514';
    end if;
    select coalesce(jsonb_agg(to_jsonb(link)), '[]'::jsonb)
      into v_existing_links
    from public.thinking_contribution_links link
    where link.organization_id = p_organization_id and link.room_id = p_room_id;
    if (
      v_room.facilitator_user_id is distinct from (p_room->>'facilitator_user_id')::uuid
      or v_room.decision_owner_user_id is distinct from (p_room->>'decision_owner_user_id')::uuid
    ) and v_role <> 'owner' then
      raise exception 'only workspace owners may reassign thinking room owners' using errcode = '42501';
    end if;
  end if;

  if exists (
    select 1
    from (values
      ((p_room->>'facilitator_user_id')::uuid),
      ((p_room->>'decision_owner_user_id')::uuid)
    ) assigned(user_id)
    where assigned.user_id is not null
      and not exists (
        select 1 from public.organization_memberships membership
        where membership.organization_id = p_organization_id
          and membership.user_id = assigned.user_id
          and membership.status = 'active'
      )
  ) then
    raise exception 'thinking room owners must be active members' using errcode = '23514';
  end if;

  if p_expected_revision > 0 and exists (
    select 1 from public.thinking_contributions contribution
    where contribution.organization_id = p_organization_id
      and contribution.room_id = p_room_id
      and not exists (
        select 1 from jsonb_to_recordset(p_contributions) as row(id uuid)
        where row.id = contribution.id
      )
  ) then
    raise exception 'contribution history is append-only' using errcode = '42501';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_contributions) as row(
      id uuid, author_user_id uuid, author_display_name_snapshot text, created_at timestamptz
    )
    join public.thinking_contributions contribution
      on contribution.id = row.id
      and contribution.organization_id = p_organization_id
      and contribution.room_id = p_room_id
    where contribution.author_user_id is distinct from row.author_user_id
      or contribution.author_display_name_snapshot is distinct from row.author_display_name_snapshot
      or contribution.created_at is distinct from row.created_at
  ) then
    raise exception 'contribution attribution is immutable' using errcode = '42501';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_contributions) as row(
      id uuid, author_user_id uuid, author_display_name_snapshot text
    )
    left join public.thinking_contributions contribution on contribution.id = row.id
    where contribution.id is null and (
      row.author_user_id <> v_user_id
      or row.author_display_name_snapshot is distinct from v_author_display_name
    )
  ) then
    raise exception 'new contribution attribution and display name must match authenticated user' using errcode = '42501';
  end if;

  if p_expected_revision > 0 and exists (
    select 1 from public.thinking_contribution_reactions reaction
    where reaction.organization_id = p_organization_id
      and reaction.room_id = p_room_id
      and reaction.actor_user_id <> v_user_id
      and not exists (
        select 1 from jsonb_to_recordset(p_reactions) as row(
          id uuid, contribution_id uuid, actor_user_id uuid, kind text, created_at timestamptz
        )
        where row.id = reaction.id
          and row.contribution_id = reaction.contribution_id
          and row.actor_user_id = reaction.actor_user_id
          and row.kind = reaction.kind
          and row.created_at = reaction.created_at
      )
  ) then
    raise exception 'reaction attribution is immutable' using errcode = '42501';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_reactions) as row(
      id uuid, contribution_id uuid, actor_user_id uuid, kind text, created_at timestamptz
    )
    left join public.thinking_contribution_reactions reaction on reaction.id = row.id
    where (reaction.id is null and row.actor_user_id <> v_user_id)
      or (reaction.id is not null and (
        reaction.contribution_id is distinct from row.contribution_id
        or reaction.actor_user_id is distinct from row.actor_user_id
        or reaction.kind is distinct from row.kind
        or reaction.created_at is distinct from row.created_at
      ))
  ) then
    raise exception 'reaction attribution is immutable' using errcode = '42501';
  end if;

  if p_expected_revision > 0 and exists (
    select 1 from public.thinking_synthesis_revisions synthesis
    where synthesis.organization_id = p_organization_id
      and synthesis.room_id = p_room_id
      and not exists (
        select 1 from jsonb_to_recordset(p_synthesis_revisions) as row(
          id uuid, number integer, belief text, unknowns jsonb, confidence text,
          chosen_direction jsonb, open_challenge_ids jsonb, source_contribution_ids jsonb,
          created_by_user_id uuid, generation_provenance jsonb, status text,
          created_at timestamptz, accepted_at timestamptz, accepted_by_user_id uuid
        )
        where row.id = synthesis.id
          and row.number = synthesis.number
          and row.belief = synthesis.belief
          and row.unknowns = synthesis.unknowns
          and row.confidence = synthesis.confidence
          and row.chosen_direction = synthesis.chosen_direction
          and row.open_challenge_ids = synthesis.open_challenge_ids
          and row.source_contribution_ids = synthesis.source_contribution_ids
          and row.created_by_user_id = synthesis.created_by_user_id
          and row.generation_provenance is not distinct from synthesis.generation_provenance
          and row.status = synthesis.status
          and row.created_at = synthesis.created_at
          and row.accepted_at is not distinct from synthesis.accepted_at
          and row.accepted_by_user_id is not distinct from synthesis.accepted_by_user_id
        or (
          row.id = synthesis.id
          and synthesis.status = 'accepted'
          and row.status = 'superseded'
          and row.number = synthesis.number
          and row.belief = synthesis.belief
          and row.unknowns = synthesis.unknowns
          and row.confidence = synthesis.confidence
          and row.chosen_direction = synthesis.chosen_direction
          and row.open_challenge_ids = synthesis.open_challenge_ids
          and row.source_contribution_ids = synthesis.source_contribution_ids
          and row.created_by_user_id = synthesis.created_by_user_id
          and row.generation_provenance is not distinct from synthesis.generation_provenance
          and row.created_at = synthesis.created_at
          and row.accepted_at is not distinct from synthesis.accepted_at
          and row.accepted_by_user_id is not distinct from synthesis.accepted_by_user_id
          and exists (
            select 1 from jsonb_to_recordset(p_synthesis_revisions) newer(number integer, status text)
            where newer.status = 'accepted' and newer.number > synthesis.number
          )
        )
      )
  ) then
    raise exception 'synthesis history is append-only' using errcode = '42501';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_synthesis_revisions) as row(
      id uuid, created_by_user_id uuid, status text, accepted_by_user_id uuid
    )
    left join public.thinking_synthesis_revisions synthesis on synthesis.id = row.id
    where synthesis.id is null and (
      row.created_by_user_id <> v_user_id
      or (row.status = 'accepted' and (
        row.accepted_by_user_id is distinct from v_user_id
        or (p_room->>'decision_owner_user_id')::uuid is distinct from v_user_id
      ))
    )
  ) then
    raise exception 'only the assigned decision owner may accept synthesis' using errcode = '42501';
  end if;

  if p_expected_revision > 0 and exists (
    select 1 from public.thinking_contribution_links link
    where link.organization_id = p_organization_id
      and link.room_id = p_room_id
      and not exists (
        select 1 from jsonb_to_recordset(p_links) as row(id uuid)
        where row.id = link.id
      )
  ) then
    raise exception 'contribution link history is append-only' using errcode = '42501';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_links) as row(
      id uuid, from_contribution_id uuid, to_contribution_id uuid,
      relationship text, created_by_user_id uuid, resolution_status text,
      resolution_note text, resolved_by_user_id uuid, created_at timestamptz,
      resolved_at timestamptz
    )
    join public.thinking_contribution_links link
      on link.id = row.id
      and link.organization_id = p_organization_id
      and link.room_id = p_room_id
    where link.from_contribution_id is distinct from row.from_contribution_id
      or link.to_contribution_id is distinct from row.to_contribution_id
      or link.relationship is distinct from row.relationship
      or link.created_by_user_id is distinct from row.created_by_user_id
      or link.created_at is distinct from row.created_at
      or (link.resolution_status = 'resolved' and (
        link.resolution_status is distinct from row.resolution_status
        or link.resolution_note is distinct from row.resolution_note
        or link.resolved_by_user_id is distinct from row.resolved_by_user_id
        or link.resolved_at is distinct from row.resolved_at
      ))
      or (link.resolution_status = 'open' and row.resolution_status = 'resolved'
        and (
          row.resolved_by_user_id is distinct from v_user_id
          or nullif(btrim(row.resolution_note), '') is null
        ))
  ) then
    raise exception 'contribution link history is append-only' using errcode = '42501';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_links) as row(
      id uuid, created_by_user_id uuid, resolution_status text,
      resolution_note text, resolved_by_user_id uuid, resolved_at timestamptz
    )
    left join public.thinking_contribution_links link on link.id = row.id
    where link.id is null and (
      row.created_by_user_id <> v_user_id
      or row.resolution_status <> 'open'
      or row.resolution_note is not null
      or row.resolved_by_user_id is not null
      or row.resolved_at is not null
    )
  ) then
    raise exception 'new contribution links must start open' using errcode = '42501';
  end if;

  if p_expected_revision = 0 then
    insert into public.thinking_rooms (
      id, organization_id, workspace_id, question, template_id, status,
      facilitator_user_id, decision_owner_user_id, context, decision_due_at,
      revision, created_at, updated_at, archived_at
    ) values (
      p_room_id, p_organization_id, p_room->>'workspace_id', p_room->>'question',
      p_room->>'template_id', p_room->>'status', v_user_id,
      (p_room->>'decision_owner_user_id')::uuid, p_room->>'context',
      (p_room->>'decision_due_at')::timestamptz, 1,
      (p_room->>'created_at')::timestamptz, (p_room->>'updated_at')::timestamptz,
      (p_room->>'archived_at')::timestamptz
    ) returning revision into v_revision;
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
    where id = p_room_id and organization_id = p_organization_id
    returning revision into v_revision;
  end if;

  delete from public.thinking_contribution_reactions
    where organization_id = p_organization_id and room_id = p_room_id;
  delete from public.thinking_contribution_links
    where organization_id = p_organization_id and room_id = p_room_id;
  delete from public.thinking_synthesis_revisions
    where organization_id = p_organization_id and room_id = p_room_id;
  delete from public.thinking_contributions
    where organization_id = p_organization_id and room_id = p_room_id;

  insert into public.thinking_contributions (
    id, organization_id, room_id, lens, body, author_user_id,
    author_display_name_snapshot, source_reference_id, mentioned_user_id,
    related_contribution_id, revision, created_at, updated_at, deleted_at
  ) select row.id, p_organization_id, p_room_id, row.lens, row.body,
    row.author_user_id, row.author_display_name_snapshot, row.source_reference_id,
    row.mentioned_user_id, row.related_contribution_id, row.revision,
    row.created_at, row.updated_at, row.deleted_at
  from jsonb_to_recordset(p_contributions) as row(
    id uuid, lens text, body text, author_user_id uuid,
    author_display_name_snapshot text, source_reference_id text,
    mentioned_user_id uuid, related_contribution_id uuid, revision bigint,
    created_at timestamptz, updated_at timestamptz, deleted_at timestamptz
  );

  insert into public.thinking_contribution_reactions (
    id, organization_id, room_id, contribution_id, actor_user_id, kind, created_at
  ) select row.id, p_organization_id, p_room_id, row.contribution_id,
    row.actor_user_id, row.kind, row.created_at
  from jsonb_to_recordset(p_reactions) as row(
    id uuid, contribution_id uuid, actor_user_id uuid, kind text, created_at timestamptz
  );

  insert into public.thinking_contribution_links (
    id, organization_id, room_id, from_contribution_id, to_contribution_id,
    relationship, created_by_user_id, resolution_status, resolution_note,
    resolved_by_user_id, created_at, resolved_at
  ) select row.id, p_organization_id, p_room_id, row.from_contribution_id,
    row.to_contribution_id, row.relationship, row.created_by_user_id,
    row.resolution_status, row.resolution_note, row.resolved_by_user_id,
    row.created_at,
    case when row.resolution_status = 'resolved' then coalesce(
      (
        select (existing->>'resolved_at')::timestamptz
        from jsonb_array_elements(v_existing_links) existing
        where (existing->>'id')::uuid = row.id
          and existing->>'resolution_status' = 'resolved'
      ),
      now()
    ) else null end
  from jsonb_to_recordset(p_links) as row(
    id uuid, from_contribution_id uuid, to_contribution_id uuid,
    relationship text, created_by_user_id uuid, resolution_status text,
    resolution_note text, resolved_by_user_id uuid, created_at timestamptz,
    resolved_at timestamptz
  );

  insert into public.thinking_synthesis_revisions (
    id, organization_id, room_id, number, belief, unknowns, confidence,
    chosen_direction, open_challenge_ids, source_contribution_ids,
    created_by_user_id, generation_provenance, status, created_at,
    accepted_at, accepted_by_user_id
  ) select row.id, p_organization_id, p_room_id, row.number, row.belief,
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
    select 1 from public.thinking_synthesis_revisions synthesis,
      jsonb_array_elements_text(synthesis.open_challenge_ids) challenge_id
    where synthesis.organization_id = p_organization_id
      and synthesis.room_id = p_room_id
      and not exists (
        select 1 from public.thinking_contributions contribution
        where contribution.organization_id = p_organization_id
          and contribution.room_id = p_room_id
          and contribution.id = challenge_id::uuid
      )
  ) or exists (
    select 1 from public.thinking_synthesis_revisions synthesis,
      jsonb_array_elements_text(synthesis.source_contribution_ids) source_id
    where synthesis.organization_id = p_organization_id
      and synthesis.room_id = p_room_id
      and not exists (
        select 1 from public.thinking_contributions contribution
        where contribution.organization_id = p_organization_id
          and contribution.room_id = p_room_id
          and contribution.id = source_id::uuid
      )
  ) then
    raise exception 'thinking room synthesis references another room' using errcode = '23514';
  end if;

  return v_revision;
end;
$$;

revoke all on function public.save_thinking_room(uuid, uuid, bigint, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_thinking_room(uuid, uuid, bigint, jsonb, jsonb, jsonb, jsonb, jsonb)
  to authenticated;

-- Active viewers may react, but the actor is always auth.uid() and this RPC
-- cannot change contributions, links, syntheses, or another member's reaction.
create function public.set_thinking_room_reaction(
  p_organization_id uuid,
  p_room_id uuid,
  p_contribution_id uuid,
  p_kind text,
  p_active boolean,
  p_reaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_revision bigint;
  v_room_status text;
  v_reaction public.thinking_contribution_reactions%rowtype;
  v_changed bigint := 0;
begin
  if v_user_id is null or not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = p_organization_id
      and membership.user_id = v_user_id
      and membership.status = 'active'
  ) then
    raise exception 'thinking room reaction permission denied' using errcode = '42501';
  end if;
  if p_kind not in ('agree', 'concern', 'needs_evidence', 'promising') then
    raise exception 'invalid thinking room reaction' using errcode = '23514';
  end if;

  select room.revision, room.status into v_revision, v_room_status
  from public.thinking_rooms room
  where room.id = p_room_id and room.organization_id = p_organization_id
  for update;
  if not found or not exists (
    select 1 from public.thinking_contributions contribution
    where contribution.id = p_contribution_id
      and contribution.room_id = p_room_id
      and contribution.organization_id = p_organization_id
      and contribution.deleted_at is null
  ) then
    raise exception 'thinking room contribution not found' using errcode = '23503';
  end if;
  if v_room_status not in ('exploring', 'synthesizing') then
    raise exception 'Thinking Room reactions require an active room' using errcode = '23514';
  end if;

  if p_active then
    insert into public.thinking_contribution_reactions (
      id, organization_id, room_id, contribution_id, actor_user_id, kind, created_at
    ) values (
      p_reaction_id, p_organization_id, p_room_id, p_contribution_id,
      v_user_id, p_kind, now()
    )
    on conflict (organization_id, contribution_id, actor_user_id, kind) do nothing
    returning * into v_reaction;
    get diagnostics v_changed = row_count;
    if v_changed = 0 then
      select reaction.* into v_reaction
      from public.thinking_contribution_reactions reaction
      where reaction.organization_id = p_organization_id
        and reaction.room_id = p_room_id
        and reaction.contribution_id = p_contribution_id
        and reaction.actor_user_id = v_user_id
        and reaction.kind = p_kind;
    end if;
  else
    delete from public.thinking_contribution_reactions reaction
    where reaction.organization_id = p_organization_id
      and reaction.room_id = p_room_id
      and reaction.contribution_id = p_contribution_id
      and reaction.actor_user_id = v_user_id
      and reaction.kind = p_kind;
    get diagnostics v_changed = row_count;
  end if;

  if v_changed > 0 then
    update public.thinking_rooms
    set revision = revision + 1, updated_at = now()
    where id = p_room_id and organization_id = p_organization_id
    returning revision into v_revision;
  end if;

  return jsonb_build_object(
    'room_revision', v_revision,
    'reaction', case when p_active then jsonb_build_object(
      'id', v_reaction.id,
      'room_id', v_reaction.room_id,
      'contribution_id', v_reaction.contribution_id,
      'actor_user_id', v_reaction.actor_user_id,
      'kind', v_reaction.kind,
      'created_at', v_reaction.created_at
    ) else null end
  );
end;
$$;

revoke all on function public.set_thinking_room_reaction(uuid, uuid, uuid, text, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.set_thinking_room_reaction(uuid, uuid, uuid, text, boolean, uuid)
  to authenticated;

-- Persist the immutable provenance receipt before the client materializes the
-- Idea Board record in the current workspace snapshot. A retry for the same
-- accepted synthesis returns the first receipt even when its expected room
-- revision is now stale or a second permitted actor performs the retry.
create function public.convert_thinking_room(
  p_organization_id uuid,
  p_room_id uuid,
  p_synthesis_revision_id uuid,
  p_idea_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_role text;
  v_room public.thinking_rooms%rowtype;
  v_synthesis public.thinking_synthesis_revisions%rowtype;
  v_existing public.thinking_room_content_origins%rowtype;
  v_revision bigint;
  v_direction jsonb;
  v_evidence_contribution_ids text[];
begin
  select membership.role into v_role
  from public.organization_memberships membership
  where membership.organization_id = p_organization_id
    and membership.user_id = v_user_id
    and membership.status = 'active';
  if v_user_id is null or v_role not in ('owner', 'editor') then
    raise exception 'thinking room conversion permission denied' using errcode = '42501';
  end if;

  select room.* into v_room
  from public.thinking_rooms room
  where room.id = p_room_id and room.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'thinking room not found' using errcode = '23503';
  end if;

  select origin.* into v_existing
  from public.thinking_room_content_origins origin
  where origin.organization_id = p_organization_id
    and origin.room_id = p_room_id
    and origin.synthesis_revision_id = p_synthesis_revision_id;
  if found then
    return jsonb_build_object(
      'room_id', v_existing.room_id,
      'synthesis_revision_id', v_existing.synthesis_revision_id,
      'idea_id', v_existing.idea_id,
      'created_by_user_id', v_existing.created_by_user_id,
      'created_at', v_existing.created_at,
      'room_revision', v_room.revision
    );
  end if;

  if v_room.revision <> p_expected_revision then
    raise exception 'thinking room conversion revision conflict' using errcode = '40001';
  end if;
  select synthesis.* into v_synthesis
  from public.thinking_synthesis_revisions synthesis
  where synthesis.id = p_synthesis_revision_id
    and synthesis.room_id = p_room_id
    and synthesis.organization_id = p_organization_id
    and synthesis.status = 'accepted'
    and v_room.decision_owner_user_id = synthesis.accepted_by_user_id
    and not exists (
      select 1 from public.thinking_synthesis_revisions newer
      where newer.organization_id = p_organization_id
        and newer.room_id = p_room_id
        and newer.number > synthesis.number
    );
  if not found or v_room.status <> 'decided' then
    raise exception 'only the current accepted synthesis can be converted' using errcode = '23514';
  end if;

  v_direction := v_synthesis.chosen_direction;
  select coalesce(array_agg(evidence_id), array[]::text[])
    into v_evidence_contribution_ids
  from jsonb_array_elements_text(
    coalesce(v_direction->'evidenceContributionIds', '[]'::jsonb)
  ) evidence_id;

  if nullif(btrim(v_direction->>'audienceTension'), '') is null
    or nullif(btrim(v_direction->>'angle'), '') is null
    or v_direction->>'basis' not in ('evidence', 'creator_experience', 'opinion')
    or (
      v_direction->>'basis' = 'evidence'
      and coalesce(jsonb_array_length(v_direction->'evidenceContributionIds'), 0) = 0
    )
  then
    raise exception 'thinking room direction is not grounded' using errcode = '23514';
  end if;
  if exists (
    select 1
    from unnest(v_evidence_contribution_ids) evidence_id
    where not exists (
      select 1 from public.thinking_contributions c
      where c.id::text = evidence_id
        and c.organization_id = p_organization_id
        and c.room_id = p_room_id
        and c.lens = 'evidence'
        and c.deleted_at is null
        and nullif(btrim(c.source_reference_id), '') is not null
    )
  ) then
    raise exception 'thinking room evidence contribution is invalid' using errcode = '23514';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(v_direction->'evidenceReferenceIds', '[]'::jsonb)
    ) evidence_reference(reference_id)
    where not exists (
      select 1 from public.thinking_contributions c
      where c.organization_id = p_organization_id
        and c.room_id = p_room_id
        and c.lens = 'evidence'
        and c.deleted_at is null
        and c.source_reference_id = evidence_reference.reference_id
        and c.id::text = any (v_evidence_contribution_ids)
    )
  ) then
    raise exception 'thinking room evidence reference is invalid' using errcode = '23514';
  end if;

  insert into public.thinking_room_content_origins (
    organization_id, room_id, synthesis_revision_id, idea_id,
    created_by_user_id, created_at
  ) values (p_organization_id, p_room_id, p_synthesis_revision_id, p_idea_id, v_user_id, now())
  returning * into v_existing;

  update public.thinking_rooms
  set status = 'converted', revision = revision + 1, updated_at = now()
  where id = p_room_id and organization_id = p_organization_id
  returning revision into v_revision;

  return jsonb_build_object(
    'room_id', v_existing.room_id,
    'synthesis_revision_id', v_existing.synthesis_revision_id,
    'idea_id', v_existing.idea_id,
    'created_by_user_id', v_existing.created_by_user_id,
    'created_at', v_existing.created_at,
    'room_revision', v_revision
  );
end;
$$;

revoke all on function public.convert_thinking_room(uuid, uuid, uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.convert_thinking_room(uuid, uuid, uuid, uuid, bigint)
  to authenticated;
