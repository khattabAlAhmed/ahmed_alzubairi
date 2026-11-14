-- Protected document functions (project.md §6.18, §7, §9). New functions only:
-- no table or column changes.
--
-- Each rule that must hold under concurrency runs here, in the caller's
-- transaction, under a row lock or in one statement. All four are SECURITY
-- INVOKER with an empty search_path, and only service_role may execute them:
-- the route checks identity and permission first (§9).
--
-- There is no reject path: the only decisions are 'grant' and
-- 'contact_first', and access ends only by revoke or expiry.
--
-- Errors carry a fixed message and SQLSTATE, so routes can map them:
--   22023 invalid_parameter_value: purpose_required, documents_required,
--         invalid_decision, expiry_in_past, expiry_needs_grant
--   42501 insufficient_privilege:  not_a_client, not_allowed
--   P0002 no_data_found:           document_unavailable, request_not_found
--   55000 object_not_in_prerequisite_state: request_not_open, request_not_granted
--
-- RLS check (step 2 of P4C-T01): the Phase 1 policies on consultations,
-- consultation_messages, consultation_attachments, meetings, documents,
-- document_requests, document_recommendations and document_access_log match
-- §7's access table: a client sees their own rows, an assistant only assigned
-- consultations, consultations.view_all every consultation, the recommend and
-- decide permissions every request, anon nothing. packages/db/tests proves it,
-- so this migration changes no policy.

-- A client asks for one or more published documents (§6.18 step 1). One row
-- per document, in the order given, duplicates in the input counted once.
-- An open or granted request for the same client and document is reused, never
-- duplicated ("Duplicate request"): `merged` is true for those rows, and the
-- reused row keeps its purpose and status. A grant whose expiry has passed but
-- that the hourly job hasn't expired yet is expired first, so it can be
-- requested again.
create function public.request_document(client_id text, document_ids uuid[], purpose text)
returns table (request_id uuid, document_id uuid, status text, merged boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  wanted uuid[];
  unavailable uuid;
begin
  if request_document.purpose is null or btrim(request_document.purpose) = '' then
    raise exception 'purpose_required' using errcode = '22023';
  end if;

  select array_agg(x.doc order by x.first_at)
  into wanted
  from (
    select u.doc, min(u.ord) as first_at
    from unnest(request_document.document_ids) with ordinality as u(doc, ord)
    where u.doc is not null
    group by u.doc
  ) x;

  if wanted is null then
    raise exception 'documents_required' using errcode = '22023';
  end if;

  -- One request at a time per client: a second call waits here, then sees the
  -- rows the first one committed, so merging never misses a fresh row. The
  -- lock also keeps disable_client (which takes the same lock) from running
  -- in the middle.
  perform 1
  from public.profiles p
  where p.clerk_user_id = request_document.client_id
    and p.role_id is null
    and p.status = 'active'
  for update;

  if not found then
    raise exception 'not_a_client' using errcode = '42501';
  end if;

  select w.doc
  into unavailable
  from unnest(wanted) as w(doc)
  where not exists (
    select 1 from public.documents d
    where d.id = w.doc and d.status = 'published'
  )
  limit 1;

  if unavailable is not null then
    raise exception 'document_unavailable'
      using errcode = 'P0002', detail = unavailable::text;
  end if;

  update public.document_requests r
  set status = 'expired'
  where r.client_id = request_document.client_id
    and r.document_id = any (wanted)
    and r.status = 'granted'
    and r.expires_at <= now();

  return query
  with inserted as (
    insert into public.document_requests as r (client_id, document_id, purpose)
    select request_document.client_id, w.doc, btrim(request_document.purpose)
    from unnest(wanted) as w(doc)
    on conflict (client_id, document_id)
      where status in ('pending_review', 'in_contact', 'granted')
      do nothing
    returning r.id, r.document_id, r.status
  )
  select
    coalesce(i.id, e.id),
    w.doc,
    coalesce(i.status, e.status),
    i.id is null
  from unnest(wanted) with ordinality as w(doc, ord)
  left join inserted i on i.document_id = w.doc
  left join public.document_requests e
    on i.id is null
    and e.client_id = request_document.client_id
    and e.document_id = w.doc
    and e.status in ('pending_review', 'in_contact', 'granted')
  order by w.ord;
end;
$$;

-- Ahmed's decision (§6.18 step 4), under a row lock on the request. Only from
-- pending_review or in_contact.
--   grant:         status granted, granted_at now, expires_at as given (null
--                  for no expiry; a past time is refused).
--   contact_first: status in_contact, linked to a `document_request`
--                  consultation for the client, assigned to the decider. A
--                  second contact_first reuses the linked consultation (and
--                  reopens it if it was closed); a new one is made only when
--                  none is linked or the linked one was deleted.
-- decided_by must be an active member holding document_requests.decide.
create function public.decide_document_request(
  request_id uuid,
  decided_by text,
  decision text,
  expires_at timestamptz default null
)
returns public.document_requests
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  req public.document_requests;
  linked uuid;
  client_locale text;
  doc_title_ar text;
  doc_title_en text;
begin
  if decide_document_request.decision is null
    or decide_document_request.decision not in ('grant', 'contact_first') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;

  if decide_document_request.decision = 'grant' then
    if decide_document_request.expires_at <= now() then
      raise exception 'expiry_in_past' using errcode = '22023';
    end if;
  elsif decide_document_request.expires_at is not null then
    raise exception 'expiry_needs_grant' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    where p.clerk_user_id = decide_document_request.decided_by
      and p.status = 'active'
      and rp.permission = 'document_requests.decide'
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into req
  from public.document_requests r
  where r.id = decide_document_request.request_id
  for update;

  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  if req.status not in ('pending_review', 'in_contact') then
    raise exception 'request_not_open' using errcode = '55000';
  end if;

  if decide_document_request.decision = 'grant' then
    update public.document_requests r
    set status = 'granted',
        granted_at = now(),
        expires_at = decide_document_request.expires_at,
        decided_by = decide_document_request.decided_by
    where r.id = req.id
    returning * into req;
    return req;
  end if;

  select c.id into linked
  from public.consultations c
  where c.id = req.consultation_id;

  if linked is null then
    select p.locale into client_locale
    from public.profiles p
    where p.clerk_user_id = req.client_id;

    select d.title_ar, d.title_en into doc_title_ar, doc_title_en
    from public.documents d
    where d.id = req.document_id;

    insert into public.consultations
      (kind, client_id, title, description, status, assigned_to)
    values (
      'document_request',
      req.client_id,
      case when client_locale = 'en' then doc_title_en else doc_title_ar end,
      req.purpose,
      'in_progress',
      decide_document_request.decided_by
    )
    returning id into linked;
  else
    update public.consultations c
    set status = 'in_progress', closed_at = null
    where c.id = linked and c.status = 'closed';
  end if;

  update public.document_requests r
  set status = 'in_contact',
      consultation_id = linked,
      decided_by = decide_document_request.decided_by
  where r.id = req.id
  returning * into req;
  return req;
end;
$$;

-- Ahmed withdraws access (§6.18 step 5), under a row lock. Only a granted
-- request can be revoked. decided_by must hold document_requests.decide.
create function public.revoke_document_request(request_id uuid, decided_by text)
returns public.document_requests
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  req public.document_requests;
begin
  if not exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    where p.clerk_user_id = revoke_document_request.decided_by
      and p.status = 'active'
      and rp.permission = 'document_requests.decide'
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into req
  from public.document_requests r
  where r.id = revoke_document_request.request_id
  for update;

  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  if req.status <> 'granted' then
    raise exception 'request_not_granted' using errcode = '55000';
  end if;

  update public.document_requests r
  set status = 'revoked',
      revoked_at = now(),
      decided_by = revoke_document_request.decided_by
  where r.id = req.id
  returning * into req;
  return req;
end;
$$;

-- For the hourly job: every grant whose expiry has passed becomes expired, in
-- one statement. Returns how many. Safe to run twice: the second run finds
-- nothing.
create function public.expire_document_grants()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with expired as (
    update public.document_requests r
    set status = 'expired'
    where r.status = 'granted'
      and r.expires_at <= now()
    returning 1
  )
  select count(*)::integer from expired;
$$;

revoke all on function public.request_document(text, uuid[], text)
  from public, anon, authenticated, service_role;
revoke all on function public.decide_document_request(uuid, text, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.revoke_document_request(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.expire_document_grants()
  from public, anon, authenticated, service_role;

grant execute on function public.request_document(text, uuid[], text) to service_role;
grant execute on function public.decide_document_request(uuid, text, text, timestamptz) to service_role;
grant execute on function public.revoke_document_request(uuid, text) to service_role;
grant execute on function public.expire_document_grants() to service_role;
