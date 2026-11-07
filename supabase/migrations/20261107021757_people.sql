-- People and permissions (project.md §5, §7, §9).
-- Supabase's default privileges give anon and authenticated full access to new
-- objects in public, so every grant below starts by revoking all of it.

-- Tables

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_ar text not null,
  name_en text not null,
  is_system boolean not null default false
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission text not null,
  primary key (role_id, permission)
);

create table public.profiles (
  clerk_user_id text primary key,
  full_name text not null,
  email text not null,
  phone text not null,
  org_type text check (org_type in ('government', 'organization', 'company', 'individual')),
  org_name text,
  job_title text,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  timezone text not null,
  notify_optional boolean not null default true,
  terms_accepted_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  role_id uuid references public.roles (id),
  created_at timestamptz not null default now()
);

create index profiles_role_id_idx on public.profiles (role_id);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id text references public.profiles (clerk_user_id),
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_actor_id_idx on public.audit_log (actor_id);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles (clerk_user_id),
  type text not null,
  entity text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- Seed: the §5 roles and matrix. Keys match ROLE_PERMISSIONS in packages/shared.

insert into public.roles (key, name_ar, name_en, is_system) values
  ('admin', 'المدير', 'Admin', true),
  ('assistant_consultant', 'مستشار مساعد', 'Assistant Consultant', true),
  ('content_editor', 'محرر محتوى', 'Content Editor', true),
  ('training_coordinator', 'منسق تدريب', 'Training Coordinator', true);

insert into public.role_permissions (role_id, permission)
select r.id, seed.permission
from (values
  ('admin', 'consultations.view_all'),
  ('admin', 'consultations.reply'),
  ('admin', 'consultations.assign'),
  ('admin', 'document_requests.recommend'),
  ('admin', 'documents.view'),
  ('admin', 'document_requests.decide'),
  ('admin', 'documents.manage'),
  ('admin', 'content.manage'),
  ('admin', 'testimonials.approve'),
  ('admin', 'training.manage'),
  ('admin', 'messages.view'),
  ('admin', 'clients.view_all'),
  ('admin', 'data.delete'),
  ('admin', 'team.manage'),
  ('assistant_consultant', 'consultations.reply'),
  ('assistant_consultant', 'document_requests.recommend'),
  ('assistant_consultant', 'documents.view'),
  ('assistant_consultant', 'messages.view'),
  ('content_editor', 'document_requests.recommend'),
  ('content_editor', 'documents.view'),
  ('content_editor', 'content.manage'),
  ('training_coordinator', 'document_requests.recommend'),
  ('training_coordinator', 'documents.view'),
  ('training_coordinator', 'training.manage')
) as seed (role_key, permission)
join public.roles r on r.key = seed.role_key;

-- RLS helper. False for no token, no profile, no role, or a disabled profile.

create function public.has_permission(key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    where p.clerk_user_id = auth.jwt() ->> 'sub'
      and p.status = 'active'
      and rp.permission = has_permission.key
  );
$$;

revoke all on function public.has_permission(text) from public, anon, authenticated, service_role;
grant execute on function public.has_permission(text) to authenticated;

-- RLS

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;

create policy roles_select on public.roles
  for select to authenticated
  using ((select public.has_permission('team.manage')));

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using ((select public.has_permission('team.manage')));

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    clerk_user_id = (select auth.jwt() ->> 'sub')
    or (role_id is null and (select public.has_permission('clients.view_all')))
    or (role_id is not null and (select public.has_permission('team.manage')))
  );

create policy audit_log_select on public.audit_log
  for select to authenticated
  using ((select public.has_permission('team.manage')));

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

-- Grants. anon gets nothing, authenticated reads only, and TRUNCATE stays
-- revoked from every API role. audit_log is append only, even for service_role.

revoke all on table
  public.roles,
  public.role_permissions,
  public.profiles,
  public.audit_log,
  public.notifications
from public, anon, authenticated, service_role;

grant select on table
  public.roles,
  public.role_permissions,
  public.profiles,
  public.audit_log,
  public.notifications
to authenticated;

grant select, insert, update, delete on table
  public.roles,
  public.role_permissions,
  public.profiles,
  public.notifications
to service_role;

grant select, insert on table public.audit_log to service_role;
