-- set_role_permissions (project.md §5, §6.19, §7, §9). A new function only: no
-- table changes.
-- A role's names and its whole permission set change in one call, in the
-- caller's transaction, under a row lock on the role. has_permission reads the
-- tables on every call, so a member sees the old set or the new one, never a
-- mix of the two.

-- Returns 'updated', or the reason nothing was written:
--   'not_found'  no role has this id
--   'admin_role' the role's key is 'admin'. Taking a permission from it could
--                lock everyone out, so only SQL run by hand edits it.
-- A null argument leaves that value as it is. permissions replaces the set:
-- '{}' removes every permission. The caller checks the keys against
-- PERMISSIONS first; this function stores what it is given.
create function public.set_role_permissions(
  role_id uuid,
  name_ar text default null,
  name_en text default null,
  permissions text[] default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  role_key text;
begin
  -- Two calls for one role run one after the other. NO KEY UPDATE, so a
  -- profile can still be given this role meanwhile (its foreign key takes a
  -- key-share lock).
  select r.key
  into role_key
  from public.roles r
  where r.id = set_role_permissions.role_id
  for no key update;

  if not found then
    return 'not_found';
  end if;

  if role_key = 'admin' then
    return 'admin_role';
  end if;

  update public.roles r
  set name_ar = coalesce(set_role_permissions.name_ar, r.name_ar),
      name_en = coalesce(set_role_permissions.name_en, r.name_en)
  where r.id = set_role_permissions.role_id;

  if set_role_permissions.permissions is not null then
    delete from public.role_permissions rp
    where rp.role_id = set_role_permissions.role_id
      and rp.permission <> all (set_role_permissions.permissions);

    insert into public.role_permissions (role_id, permission)
    select distinct set_role_permissions.role_id, wanted.permission
    from unnest(set_role_permissions.permissions) as wanted (permission)
    on conflict do nothing;
  end if;

  return 'updated';
end;
$$;

revoke all on function public.set_role_permissions(uuid, text, text, text[]) from public, anon, authenticated, service_role;
grant execute on function public.set_role_permissions(uuid, text, text, text[]) to service_role;
