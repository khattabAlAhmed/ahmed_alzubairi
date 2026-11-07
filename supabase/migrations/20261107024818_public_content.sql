-- Public content (project.md §7, §9, §6.11).
-- anon gets nothing, even on published rows: public pages read on the server
-- through the service client (lib/content). Key lists match packages/shared.

-- Shared updated_at trigger

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;

-- Tables

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.home_sections (
  key text primary key check (key in (
    'hero', 'stats', 'expertise', 'audiences', 'services', 'projects',
    'partners', 'testimonials', 'media', 'latest', 'newsletter', 'contact'
  )),
  position integer not null default 0 check (position >= 0),
  is_visible boolean not null default false,
  content_ar jsonb,
  content_en jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.home_stats (
  id uuid primary key default gen_random_uuid(),
  label_ar text,
  label_en text,
  value text,
  position integer not null default 0 check (position >= 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('about', 'privacy', 'terms')),
  title_ar text,
  title_en text,
  body_ar jsonb,
  body_en jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.timeline_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('career', 'qualification')),
  title_ar text,
  title_en text,
  description_ar text,
  description_en text,
  period text,
  position integer not null default 0 check (position >= 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expertise_areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_ar text,
  title_en text,
  summary_ar text,
  summary_en text,
  body_ar jsonb,
  body_en jsonb,
  position integer not null default 0 check (position >= 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  expertise_id uuid references public.expertise_areas (id) on delete set null,
  title_ar text,
  title_en text,
  summary_ar text,
  summary_en text,
  audience_ar text,
  audience_en text,
  deliverables_ar text,
  deliverables_en text,
  stages_ar text,
  stages_en text,
  is_featured boolean not null default false,
  position integer not null default 0 check (position >= 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_expertise_id_idx on public.services (expertise_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  expertise_id uuid references public.expertise_areas (id) on delete set null,
  org_type text check (org_type in ('government', 'organization', 'company', 'individual')),
  title_ar text,
  title_en text,
  org_name_ar text,
  org_name_en text,
  org_label_ar text,
  org_label_en text,
  hide_org_name boolean not null default false,
  goal_ar text,
  goal_en text,
  role_ar text,
  role_en text,
  duration_ar text,
  duration_en text,
  activities_ar text,
  activities_en text,
  results_ar text,
  results_en text,
  key_result_ar text,
  key_result_en text,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_expertise_id_idx on public.projects (expertise_id);

create table public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  path text not null,
  alt_ar text,
  alt_en text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_images_project_id_idx on public.project_images (project_id);

create table public.project_services (
  project_id uuid not null references public.projects (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (project_id, service_id)
);

create index project_services_service_id_idx on public.project_services (service_id);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('consultations', 'training', 'documents', 'account')),
  service_id uuid references public.services (id) on delete set null,
  question_ar text,
  question_en text,
  answer_ar text,
  answer_en text,
  position integer not null default 0 check (position >= 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index faqs_service_id_idx on public.faqs (service_id);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name_ar text,
  name_en text,
  logo_path text,
  consent_confirmed boolean not null default false,
  admin_approved boolean not null default false,
  approved_by text references public.profiles (clerk_user_id),
  position integer not null default 0 check (position >= 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote_ar text,
  quote_en text,
  author_ar text,
  author_en text,
  partner_id uuid references public.partners (id) on delete set null,
  letter_path text,
  consent_confirmed boolean not null default false,
  admin_approved boolean not null default false,
  approved_by text references public.profiles (clerk_user_id),
  position integer not null default 0 check (position >= 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug_ar text unique,
  slug_en text unique,
  expertise_id uuid references public.expertise_areas (id) on delete set null,
  title_ar text,
  title_en text,
  excerpt_ar text,
  excerpt_en text,
  body_ar jsonb,
  body_en jsonb,
  cover_path text,
  reading_minutes_ar integer check (reading_minutes_ar > 0),
  reading_minutes_en integer check (reading_minutes_en > 0),
  published_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_expertise_id_idx on public.posts (expertise_id);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  expertise_id uuid references public.expertise_areas (id) on delete set null,
  kind text not null check (kind in ('guide', 'template', 'working_paper')),
  title_ar text,
  title_en text,
  description_ar text,
  description_en text,
  storage_key text not null,
  access text not null check (access in ('direct', 'email')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resources_expertise_id_idx on public.resources (expertise_id);

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('media', 'events', 'conferences')),
  title_ar text,
  title_en text,
  outlet_ar text,
  outlet_en text,
  date date,
  image_path text,
  url text,
  video_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  type text not null check (type in ('in_person', 'online_live', 'recorded', 'custom')),
  title_ar text,
  title_en text,
  description_ar text,
  description_en text,
  audience_ar text,
  audience_en text,
  starts_at timestamptz,
  place_ar text,
  place_en text,
  online_url text,
  seats integer check (seats > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current

create trigger set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.home_sections
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.home_stats
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.pages
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.timeline_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.expertise_areas
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_images
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.faqs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.partners
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.testimonials
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.posts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.resources
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.media_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

-- Seed: the 12 §6.2 sections, hidden and empty. No other content (§14 #6).

insert into public.home_sections (key, position) values
  ('hero', 1),
  ('stats', 2),
  ('expertise', 3),
  ('audiences', 4),
  ('services', 5),
  ('projects', 6),
  ('partners', 7),
  ('testimonials', 8),
  ('media', 9),
  ('latest', 10),
  ('newsletter', 11),
  ('contact', 12);

-- RLS

alter table public.site_settings enable row level security;
alter table public.home_sections enable row level security;
alter table public.home_stats enable row level security;
alter table public.pages enable row level security;
alter table public.timeline_items enable row level security;
alter table public.expertise_areas enable row level security;
alter table public.services enable row level security;
alter table public.projects enable row level security;
alter table public.project_images enable row level security;
alter table public.project_services enable row level security;
alter table public.faqs enable row level security;
alter table public.partners enable row level security;
alter table public.testimonials enable row level security;
alter table public.posts enable row level security;
alter table public.resources enable row level security;
alter table public.media_items enable row level security;
alter table public.courses enable row level security;

create policy site_settings_select on public.site_settings
  for select to authenticated
  using ((select public.has_permission('team.manage')));

create policy home_sections_select on public.home_sections
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy home_stats_select on public.home_stats
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy pages_select on public.pages
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy timeline_items_select on public.timeline_items
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy expertise_areas_select on public.expertise_areas
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy services_select on public.services
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy projects_select on public.projects
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy project_images_select on public.project_images
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy project_services_select on public.project_services
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy faqs_select on public.faqs
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy partners_select on public.partners
  for select to authenticated
  using (
    (select public.has_permission('content.manage'))
    or (select public.has_permission('testimonials.approve'))
  );

create policy testimonials_select on public.testimonials
  for select to authenticated
  using (
    (select public.has_permission('content.manage'))
    or (select public.has_permission('testimonials.approve'))
  );

create policy posts_select on public.posts
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy resources_select on public.resources
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy media_items_select on public.media_items
  for select to authenticated
  using ((select public.has_permission('content.manage')));

create policy courses_select on public.courses
  for select to authenticated
  using ((select public.has_permission('training.manage')));

-- Grants. anon gets nothing, authenticated reads only, and TRUNCATE stays
-- revoked from every API role.

revoke all on table
  public.site_settings,
  public.home_sections,
  public.home_stats,
  public.pages,
  public.timeline_items,
  public.expertise_areas,
  public.services,
  public.projects,
  public.project_images,
  public.project_services,
  public.faqs,
  public.partners,
  public.testimonials,
  public.posts,
  public.resources,
  public.media_items,
  public.courses
from public, anon, authenticated, service_role;

grant select on table
  public.site_settings,
  public.home_sections,
  public.home_stats,
  public.pages,
  public.timeline_items,
  public.expertise_areas,
  public.services,
  public.projects,
  public.project_images,
  public.project_services,
  public.faqs,
  public.partners,
  public.testimonials,
  public.posts,
  public.resources,
  public.media_items,
  public.courses
to authenticated;

grant select, insert, update, delete on table
  public.site_settings,
  public.home_sections,
  public.home_stats,
  public.pages,
  public.timeline_items,
  public.expertise_areas,
  public.services,
  public.projects,
  public.project_images,
  public.project_services,
  public.faqs,
  public.partners,
  public.testimonials,
  public.posts,
  public.resources,
  public.media_items,
  public.courses
to service_role;
