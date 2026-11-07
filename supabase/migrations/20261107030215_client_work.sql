-- Client work (project.md §5, §6.17, §6.18, §7, §9).
-- Key lists match packages/shared. document_requests has no rejected status:
-- there is no reject action anywhere (§9).

-- Tables

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'consultation' check (kind in ('consultation', 'document_request')),
  client_id text not null references public.profiles (clerk_user_id),
  service_id uuid references public.services (id) on delete set null,
  title text not null,
  description text not null,
  organization text,
  status text not null default 'new' check (status in ('new', 'in_review', 'in_progress', 'scheduled', 'closed')),
  assigned_to text references public.profiles (clerk_user_id),
  first_reply_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index consultations_client_id_idx on public.consultations (client_id);
create index consultations_assigned_to_idx on public.consultations (assigned_to);

create table public.consultation_messages (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations (id) on delete cascade,
  sender_id text not null references public.profiles (clerk_user_id),
  body text,
  created_at timestamptz not null default now()
);

create index consultation_messages_consultation_idx
  on public.consultation_messages (consultation_id, created_at);

-- message_id stays null until the message links the finalized file.
create table public.consultation_attachments (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations (id) on delete cascade,
  message_id uuid references public.consultation_messages (id) on delete cascade,
  storage_key text not null,
  file_name text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes > 0),
  status text not null default 'uploading' check (status in ('uploading', 'ready')),
  uploaded_by text not null references public.profiles (clerk_user_id),
  created_at timestamptz not null default now()
);

create index consultation_attachments_consultation_idx on public.consultation_attachments (consultation_id);
create index consultation_attachments_message_idx on public.consultation_attachments (message_id);
create index consultation_attachments_uploading_idx
  on public.consultation_attachments (created_at) where status = 'uploading';

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations (id) on delete cascade,
  platform text not null,
  url text not null,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index meetings_consultation_idx on public.meetings (consultation_id);
create index meetings_reminder_idx on public.meetings (starts_at) where reminder_sent_at is null;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'course_certificate', 'qualification_certificate', 'thank_you_letter',
    'recommendation_letter', 'experience_certificate', 'project_photo', 'event_photo'
  )),
  title_ar text not null,
  title_en text not null,
  storage_key text not null,
  mime text not null,
  access_mode text not null check (access_mode in ('view', 'view_download')),
  status text not null default 'draft' check (status in ('draft', 'published'))
);

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.profiles (clerk_user_id),
  document_id uuid not null references public.documents (id) on delete cascade,
  purpose text not null,
  status text not null default 'pending_review' check (status in (
    'pending_review', 'in_contact', 'granted', 'expired', 'revoked'
  )),
  consultation_id uuid references public.consultations (id) on delete set null,
  decided_by text references public.profiles (clerk_user_id),
  granted_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index document_requests_open_idx
  on public.document_requests (client_id, document_id)
  where status in ('pending_review', 'in_contact', 'granted');
create index document_requests_document_idx on public.document_requests (document_id);
create index document_requests_expiry_idx
  on public.document_requests (expires_at) where status = 'granted';

create table public.document_recommendations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.document_requests (id) on delete cascade,
  member_id text not null references public.profiles (clerk_user_id),
  recommendation text not null check (recommendation in ('approve', 'needs_clarification')),
  note text,
  created_at timestamptz not null default now()
);

create index document_recommendations_request_idx on public.document_recommendations (request_id);

-- The log outlives what it records, so request_id and document_id have no
-- foreign key: deleting a document never touches its log.
create table public.document_access_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  document_id uuid not null,
  client_id text not null references public.profiles (clerk_user_id),
  action text not null check (action in ('view', 'download')),
  created_at timestamptz not null default now()
);

create index document_access_log_document_idx on public.document_access_log (document_id);
create index document_access_log_client_idx on public.document_access_log (client_id);

create table public.course_registrations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  client_id text not null references public.profiles (clerk_user_id),
  created_at timestamptz not null default now(),
  unique (course_id, client_id)
);

create index course_registrations_client_idx on public.course_registrations (client_id);

create table public.custom_training_requests (
  id uuid primary key default gen_random_uuid(),
  client_id text references public.profiles (clerk_user_id),
  org_name text not null,
  trainee_count integer not null check (trainee_count > 0),
  topic text not null,
  suggested_date date not null,
  place text,
  contact_email text not null,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  org_type text not null check (org_type in ('government', 'organization', 'company', 'individual')),
  subject text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  locale text not null check (locale in ('ar', 'en')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  confirm_token_hash text,
  source text not null check (source in ('footer', 'home', 'blog', 'resource')),
  consented_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.email_templates (
  event text primary key check (event in (
    'consultation_new', 'consultation_received', 'consultation_assigned',
    'consultation_reply', 'meeting', 'meeting_reminder', 'document_request',
    'document_recommendation', 'document_granted', 'course_registration',
    'custom_training_request', 'contact_message', 'account_new'
  )),
  subject_ar text not null,
  subject_en text not null,
  body_ar text not null,
  body_en text not null
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  to_email text not null,
  locale text not null check (locale in ('ar', 'en')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index email_outbox_retry_idx on public.email_outbox (created_at) where status <> 'sent';

-- RLS helpers

create function public.visible_consultation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.consultations c
  where c.client_id = auth.jwt() ->> 'sub'
    or (
      c.assigned_to = auth.jwt() ->> 'sub'
      and exists (
        select 1 from public.profiles p
        where p.clerk_user_id = c.assigned_to and p.status = 'active'
      )
    )
    or public.has_permission('consultations.view_all');
$$;

revoke all on function public.visible_consultation_ids() from public, anon, authenticated, service_role;
grant execute on function public.visible_consultation_ids() to authenticated;

-- §5 scoped client data. A disabled team member gets nothing.
create function public.scoped_client_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select c.client_id
  from public.consultations c
  join public.profiles p on p.clerk_user_id = c.assigned_to
  where c.assigned_to = auth.jwt() ->> 'sub'
    and p.status = 'active'
  union
  select r.client_id
  from public.course_registrations r
  where public.has_permission('training.manage');
$$;

revoke all on function public.scoped_client_ids() from public, anon, authenticated, service_role;
grant execute on function public.scoped_client_ids() to authenticated;

-- RLS

alter table public.consultations enable row level security;
alter table public.consultation_messages enable row level security;
alter table public.consultation_attachments enable row level security;
alter table public.meetings enable row level security;
alter table public.documents enable row level security;
alter table public.document_requests enable row level security;
alter table public.document_recommendations enable row level security;
alter table public.document_access_log enable row level security;
alter table public.course_registrations enable row level security;
alter table public.custom_training_requests enable row level security;
alter table public.contact_messages enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_outbox enable row level security;

create policy consultations_select on public.consultations
  for select to authenticated
  using (id in (select public.visible_consultation_ids()));

create policy consultation_messages_select on public.consultation_messages
  for select to authenticated
  using (consultation_id in (select public.visible_consultation_ids()));

create policy consultation_attachments_select on public.consultation_attachments
  for select to authenticated
  using (consultation_id in (select public.visible_consultation_ids()));

create policy meetings_select on public.meetings
  for select to authenticated
  using (consultation_id in (select public.visible_consultation_ids()));

create policy documents_select on public.documents
  for select to authenticated
  using (
    (select public.has_permission('documents.view'))
    or (select public.has_permission('documents.manage'))
  );

create policy document_requests_select on public.document_requests
  for select to authenticated
  using (
    client_id = (select auth.jwt() ->> 'sub')
    or (select public.has_permission('document_requests.recommend'))
    or (select public.has_permission('document_requests.decide'))
  );

create policy document_recommendations_select on public.document_recommendations
  for select to authenticated
  using (
    (select public.has_permission('document_requests.recommend'))
    or (select public.has_permission('document_requests.decide'))
  );

create policy document_access_log_select on public.document_access_log
  for select to authenticated
  using ((select public.has_permission('document_requests.decide')));

create policy course_registrations_select on public.course_registrations
  for select to authenticated
  using (
    client_id = (select auth.jwt() ->> 'sub')
    or (select public.has_permission('training.manage'))
  );

create policy custom_training_requests_select on public.custom_training_requests
  for select to authenticated
  using ((select public.has_permission('training.manage')));

create policy contact_messages_select on public.contact_messages
  for select to authenticated
  using ((select public.has_permission('messages.view')));

create policy newsletter_subscribers_select on public.newsletter_subscribers
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy email_templates_select on public.email_templates
  for select to authenticated
  using ((select public.has_permission('team.manage')));

-- email_outbox has no policy: no permission covers it, so only the server reads it.

drop policy profiles_select on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    clerk_user_id = (select auth.jwt() ->> 'sub')
    or (role_id is null and (select public.has_permission('clients.view_all')))
    or (role_id is not null and (select public.has_permission('team.manage')))
    or (role_id is null and clerk_user_id in (select public.scoped_client_ids()))
  );

-- Grants. anon gets nothing, authenticated reads only, and TRUNCATE stays
-- revoked from every API role. authenticated never reads a storage key or a
-- token hash: those columns stay out of its grants.

revoke all on table
  public.consultations,
  public.consultation_messages,
  public.consultation_attachments,
  public.meetings,
  public.documents,
  public.document_requests,
  public.document_recommendations,
  public.document_access_log,
  public.course_registrations,
  public.custom_training_requests,
  public.contact_messages,
  public.newsletter_subscribers,
  public.email_templates,
  public.email_outbox
from public, anon, authenticated, service_role;

grant select on table
  public.consultations,
  public.consultation_messages,
  public.meetings,
  public.document_requests,
  public.document_recommendations,
  public.document_access_log,
  public.course_registrations,
  public.custom_training_requests,
  public.contact_messages,
  public.email_templates
to authenticated;

grant select (
  id, consultation_id, message_id, file_name, mime, size_bytes, status, uploaded_by, created_at
) on table public.consultation_attachments to authenticated;

grant select (
  id, category, title_ar, title_en, mime, access_mode, status
) on table public.documents to authenticated;

grant select (
  id, email, locale, status, source, consented_at, created_at
) on table public.newsletter_subscribers to authenticated;

grant select, insert, update, delete on table
  public.consultations,
  public.consultation_messages,
  public.consultation_attachments,
  public.meetings,
  public.documents,
  public.document_requests,
  public.document_recommendations,
  public.course_registrations,
  public.custom_training_requests,
  public.contact_messages,
  public.newsletter_subscribers,
  public.email_templates
to service_role;

-- Written only by the server: the log is append only, and outbox rows are kept.
grant select, insert on table public.document_access_log to service_role;
grant select, insert, update on table public.email_outbox to service_role;
