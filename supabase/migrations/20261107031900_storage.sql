-- Storage buckets (project.md §7, §9, §14 #4).
-- storage.objects has RLS on and no policies, so anon and authenticated get no
-- direct access to any bucket. The server signs URLs after its own checks.
-- Adding no policy is deliberate: public-media serves public reads through its
-- bucket flag, and a SELECT policy would also let anyone list its files.
-- Limits and types match UPLOAD_TARGET_RULES and ATTACHMENT_MIMES in packages/shared.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-media', 'public-media', true, 10485760, array[
    'image/jpeg', 'image/png', 'application/pdf'
  ]),
  ('resources', 'resources', false, 10485760, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  ('attachments', 'attachments', false, 10485760, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]),
  ('documents', 'documents', false, 10485760, array[
    'application/pdf', 'image/jpeg', 'image/png'
  ]),
  ('document-views', 'document-views', false, 26214400, array[
    'application/pdf', 'image/jpeg', 'image/png'
  ]),
  ('internal', 'internal', false, 10485760, array[
    'application/pdf', 'image/jpeg', 'image/png'
  ]);

-- authenticated never reads a storage key (§9). The public_content migration
-- granted the whole table, so narrow it to every column but storage_key.

revoke select on table public.resources from authenticated;

grant select (
  id, expertise_id, kind, title_ar, title_en, description_ar, description_en,
  access, status, created_at, updated_at
) on table public.resources to authenticated;
