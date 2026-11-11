-- disable_client (project.md §6.16, §7, §9). A new function only: no table changes.
-- Disabling a client and closing their open consultations must hold under
-- concurrency, so both happen here, in the caller's transaction, under a row
-- lock on the profile.

-- Returns how many consultations it closed. NULL means client_id isn't a
-- client: no such profile, or a team member (role_id is set), and nothing is
-- changed. Safe to run twice: the second run finds nothing open and returns 0.
create function public.disable_client(client_id text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  closed_count integer;
begin
  -- FOR UPDATE also blocks a consultation being inserted for this client (its
  -- foreign key takes a key-share lock), so the update below sees every row
  -- committed before the lock was granted.
  perform 1
  from public.profiles p
  where p.clerk_user_id = disable_client.client_id
    and p.role_id is null
  for update;

  if not found then
    return null;
  end if;

  update public.profiles p
  set status = 'disabled'
  where p.clerk_user_id = disable_client.client_id
    and p.role_id is null
    and p.status <> 'disabled';

  update public.consultations c
  set status = 'closed', closed_at = now()
  where c.client_id = disable_client.client_id
    and c.status <> 'closed';

  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;

revoke all on function public.disable_client(text) from public, anon, authenticated, service_role;
grant execute on function public.disable_client(text) to service_role;
