-- Atomically establish the first durable organization for the authenticated user.
-- Display values may come from user input, but authorization is based only on auth.uid().
create or replace function public.ensure_user_workspace(
  p_display_name text default null,
  p_workspace_name text default null
)
returns table (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  membership_role text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_display_name text;
  v_workspace_name text;
  v_slug_base text;
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Serialise first-workspace creation for concurrent callback/app requests.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user_id::text));

  select membership.organization_id
    into v_organization_id
  from public.organization_memberships membership
  where membership.user_id = v_user_id
    and membership.status = 'active'
  order by membership.created_at asc
  limit 1;

  if v_organization_id is null then
    select user_record.email
      into v_email
    from auth.users user_record
    where user_record.id = v_user_id;

    v_display_name := left(
      coalesce(
        nullif(pg_catalog.btrim(p_display_name), ''),
        nullif(pg_catalog.split_part(coalesce(v_email, ''), '@', 1), ''),
        'Museboard creator'
      ),
      120
    );
    v_workspace_name := left(
      coalesce(
        nullif(pg_catalog.btrim(p_workspace_name), ''),
        v_display_name || '''s workspace'
      ),
      120
    );
    v_slug_base := pg_catalog.trim(
      both '-' from pg_catalog.regexp_replace(
        pg_catalog.lower(v_workspace_name),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    );
    if v_slug_base = '' then v_slug_base := 'workspace'; end if;

    insert into public.organizations (name, slug, created_by)
    values (
      v_workspace_name,
      left(v_slug_base, 48) || '-' || left(v_user_id::text, 8),
      v_user_id
    )
    returning id into v_organization_id;

    insert into public.organization_memberships (
      organization_id,
      user_id,
      role,
      status,
      email_snapshot
    ) values (
      v_organization_id,
      v_user_id,
      'owner',
      'active',
      v_email
    );

    insert into public.creator_profiles (
      organization_id,
      display_name,
      audience,
      profile
    ) values (
      v_organization_id,
      v_display_name,
      '',
      '{}'::jsonb
    );
  end if;

  return query
  select
    organization.id,
    organization.name,
    organization.slug,
    membership.role::text
  from public.organizations organization
  join public.organization_memberships membership
    on membership.organization_id = organization.id
  where organization.id = v_organization_id
    and membership.user_id = v_user_id
    and membership.status = 'active';
end;
$$;

revoke all on function public.ensure_user_workspace(text, text)
  from public, anon, authenticated;
grant execute on function public.ensure_user_workspace(text, text)
  to authenticated;
