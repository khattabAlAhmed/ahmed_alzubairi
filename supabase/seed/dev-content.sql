-- Dev seed content (P2P-T03). NOT a migration: apply it to the dev project only,
-- never to production. Every name, quote, letter and document here is made up
-- (§14 #6): "مثال" / "Example". Storage keys under `dev-seed/` point to no file.
--
-- Idempotent: fixed ids (prefix de5eed00-) and `on conflict ... do update`, so
-- it can run again to reset the seed rows. It overwrites the 12 home sections
-- and the site settings it sets. Rows not created here are never touched.
--
-- Cases it covers: a project with a hidden organization name (602), a published
-- testimonial without consent (903) and one without approval (904), the same for
-- partners (803, 804), English-only rows (service 504, FAQ 704), Arabic-only
-- rows (service 505, post 1002), a draft in every table with a status, and the
-- 12 home sections, all visible and published.

begin;

insert into public.site_settings (key, value) values
  ('contact_email', '"contact@example.com"'::jsonb),
  ('whatsapp_number', '"+967700000000"'::jsonb),
  ('linkedin_url', '"https://www.linkedin.com/in/example"'::jsonb),
  ('social_links', '[{"platform": "X", "url": "https://x.com/example"}]'::jsonb),
  ('cv_visible', 'false'::jsonb)
on conflict (key) do update set value = excluded.value;

insert into public.home_sections (key, position, is_visible, status, content_ar, content_en) values
  ('hero', 1, true, 'published', '{"name": "مثال الاسم", "title": "مستشار في الإدارة والحوكمة (مثال)", "valueStatement": "نص تجريبي لعبارة القيمة، يُستبدل بالمحتوى الحقيقي."}'::jsonb, '{"name": "Example Name", "title": "Management and governance consultant (example)", "valueStatement": "Placeholder value statement, replaced by real content."}'::jsonb),
  ('stats', 2, true, 'published', '{"heading": "أرقام سريعة (مثال)"}'::jsonb, '{"heading": "Quick stats (example)"}'::jsonb),
  ('expertise', 3, true, 'published', '{"heading": "مجالات الخبرة", "intro": "نص تمهيدي تجريبي."}'::jsonb, '{"heading": "Areas of expertise", "intro": "Placeholder intro text."}'::jsonb),
  ('audiences', 4, true, 'published', '{"heading": "لمن أعمل", "items": [{"title": "الجهات الحكومية", "description": "وصف تجريبي."}, {"title": "المنظمات الإنسانية", "description": "وصف تجريبي."}, {"title": "القطاع الخاص", "description": "وصف تجريبي."}]}'::jsonb, '{"heading": "Who I work with", "items": [{"title": "Government", "description": "Placeholder description."}, {"title": "Humanitarian organizations", "description": "Placeholder description."}, {"title": "Private sector", "description": "Placeholder description."}]}'::jsonb),
  ('services', 5, true, 'published', '{"heading": "خدمات مميزة"}'::jsonb, '{"heading": "Featured services"}'::jsonb),
  ('projects', 6, true, 'published', '{"heading": "مشاريع مختارة"}'::jsonb, '{"heading": "Selected projects"}'::jsonb),
  ('partners', 7, true, 'published', '{"heading": "جهات عملت معها"}'::jsonb, '{"heading": "Organizations I''ve worked with"}'::jsonb),
  ('testimonials', 8, true, 'published', '{"heading": "آراء العملاء"}'::jsonb, '{"heading": "Testimonials"}'::jsonb),
  ('media', 9, true, 'published', '{"heading": "الظهور الإعلامي"}'::jsonb, '{"heading": "Media"}'::jsonb),
  ('latest', 10, true, 'published', '{"heading": "أحدث المقالات والموارد"}'::jsonb, '{"heading": "Latest articles and resources"}'::jsonb),
  ('newsletter', 11, true, 'published', '{"heading": "النشرة البريدية", "intro": "نص تجريبي عن النشرة."}'::jsonb, '{"heading": "Newsletter", "intro": "Placeholder newsletter text."}'::jsonb),
  ('contact', 12, true, 'published', '{"heading": "تواصل سريع"}'::jsonb, '{"heading": "Quick contact"}'::jsonb)
on conflict (key) do update set position = excluded.position, is_visible = excluded.is_visible, status = excluded.status, content_ar = excluded.content_ar, content_en = excluded.content_en;

insert into public.home_stats (id, label_ar, label_en, value, position, status) values
  ('de5eed00-0000-4000-8000-000000000101', 'سنوات الخبرة (مثال)', 'Years of experience (example)', '15+', 0, 'published'),
  ('de5eed00-0000-4000-8000-000000000102', 'مشروع (مثال)', 'Projects (example)', '40', 1, 'published'),
  ('de5eed00-0000-4000-8000-000000000103', 'جهة (مثال)', 'Organizations (example)', '25', 2, 'published'),
  ('de5eed00-0000-4000-8000-000000000104', 'متدرب (مثال)', 'Trainees (example)', '1,200', 3, 'published'),
  ('de5eed00-0000-4000-8000-000000000105', 'رقم مسودة', 'Draft stat', '0', 4, 'draft')
on conflict (id) do update set label_ar = excluded.label_ar, label_en = excluded.label_en, value = excluded.value, position = excluded.position, status = excluded.status;

insert into public.pages (id, key, title_ar, title_en, body_ar, body_en, status) values
  ('de5eed00-0000-4000-8000-000000000201', 'about', 'من أنا', 'About', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "نبذة تجريبية عن مثال الاسم. هذا نص مؤقت للتطوير فقط."}]}]}'::jsonb, '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "A placeholder bio for Example Name. Temporary development text only."}]}]}'::jsonb, 'published'),
  ('de5eed00-0000-4000-8000-000000000202', 'privacy', 'سياسة الخصوصية', 'Privacy policy', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "مسودة تجريبية لسياسة الخصوصية، لم يراجعها أحمد بعد."}]}]}'::jsonb, '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Placeholder draft privacy policy, not yet reviewed."}]}]}'::jsonb, 'published'),
  ('de5eed00-0000-4000-8000-000000000203', 'terms', 'شروط الاستخدام', 'Terms of use', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "مسودة تجريبية لشروط الاستخدام، لم يراجعها أحمد بعد."}]}]}'::jsonb, '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Placeholder draft terms of use, not yet reviewed."}]}]}'::jsonb, 'published')
on conflict (key) do update set title_ar = excluded.title_ar, title_en = excluded.title_en, body_ar = excluded.body_ar, body_en = excluded.body_en, status = excluded.status;

insert into public.timeline_items (id, kind, title_ar, title_en, description_ar, description_en, period, position, status) values
  ('de5eed00-0000-4000-8000-000000000301', 'career', 'مستشار أول في جهة مثال', 'Senior consultant at Example Org', 'وصف تجريبي.', 'Placeholder description.', '2018 – 2024', 0, 'published'),
  ('de5eed00-0000-4000-8000-000000000302', 'career', 'مدير برامج في منظمة مثال', 'Program manager at Example NGO', null, null, '2012 – 2018', 1, 'published'),
  ('de5eed00-0000-4000-8000-000000000303', 'qualification', 'ماجستير تجريبي في الإدارة', 'Example master''s degree in management', null, null, '2010', 2, 'published'),
  ('de5eed00-0000-4000-8000-000000000304', 'qualification', 'شهادة مسودة', 'Draft qualification', null, null, null, 3, 'draft')
on conflict (id) do update set kind = excluded.kind, title_ar = excluded.title_ar, title_en = excluded.title_en, description_ar = excluded.description_ar, description_en = excluded.description_en, period = excluded.period, position = excluded.position, status = excluded.status;

insert into public.expertise_areas (id, slug, title_ar, title_en, summary_ar, summary_en, body_ar, body_en, position, status) values
  ('de5eed00-0000-4000-8000-000000000401', 'governance', 'الحوكمة (مثال)', 'Governance (example)', 'ملخص تجريبي لهذا المجال.', 'Placeholder summary for this area.', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "نص تجريبي مفصل."}]}]}'::jsonb, '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Placeholder detailed text."}]}]}'::jsonb, 0, 'published'),
  ('de5eed00-0000-4000-8000-000000000402', 'management', 'الإدارة (مثال)', 'Management (example)', 'ملخص تجريبي لهذا المجال.', 'Placeholder summary for this area.', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "نص تجريبي مفصل."}]}]}'::jsonb, '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Placeholder detailed text."}]}]}'::jsonb, 1, 'published'),
  ('de5eed00-0000-4000-8000-000000000403', 'humanitarian', 'العمل الإنساني والتنمية (مثال)', 'Humanitarian work and development (example)', 'ملخص تجريبي لهذا المجال.', 'Placeholder summary for this area.', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "نص تجريبي مفصل."}]}]}'::jsonb, '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Placeholder detailed text."}]}]}'::jsonb, 2, 'published'),
  ('de5eed00-0000-4000-8000-000000000404', 'draft-area', 'مجال مسودة', 'Draft area', 'مسودة', 'Draft', null, null, 3, 'draft')
on conflict (id) do update set slug = excluded.slug, title_ar = excluded.title_ar, title_en = excluded.title_en, summary_ar = excluded.summary_ar, summary_en = excluded.summary_en, body_ar = excluded.body_ar, body_en = excluded.body_en, position = excluded.position, status = excluded.status;

insert into public.services (id, slug, expertise_id, is_featured, position, status, title_ar, title_en, summary_ar, summary_en, audience_ar, audience_en, deliverables_ar, deliverables_en, stages_ar, stages_en) values
  ('de5eed00-0000-4000-8000-000000000501', 'governance-review', 'de5eed00-0000-4000-8000-000000000401', true, 0, 'published', 'مراجعة الحوكمة (مثال)', 'Governance review (example)', 'ملخص تجريبي للخدمة.', 'Placeholder service summary.', 'الجهات المستفيدة (مثال).', 'Who it''s for (example).', 'المخرجات (مثال).', 'Deliverables (example).', 'المراحل (مثال).', 'Stages (example).'),
  ('de5eed00-0000-4000-8000-000000000502', 'strategic-planning', 'de5eed00-0000-4000-8000-000000000402', true, 1, 'published', 'التخطيط الاستراتيجي (مثال)', 'Strategic planning (example)', 'ملخص تجريبي للخدمة.', 'Placeholder service summary.', 'الجهات المستفيدة (مثال).', 'Who it''s for (example).', 'المخرجات (مثال).', 'Deliverables (example).', 'المراحل (مثال).', 'Stages (example).'),
  ('de5eed00-0000-4000-8000-000000000503', 'program-evaluation', 'de5eed00-0000-4000-8000-000000000403', true, 2, 'published', 'تقييم البرامج (مثال)', 'Program evaluation (example)', 'ملخص تجريبي للخدمة.', 'Placeholder service summary.', 'الجهات المستفيدة (مثال).', 'Who it''s for (example).', 'المخرجات (مثال).', 'Deliverables (example).', 'المراحل (مثال).', 'Stages (example).'),
  ('de5eed00-0000-4000-8000-000000000504', 'english-only-service', 'de5eed00-0000-4000-8000-000000000402', false, 3, 'published', null, 'English-only service (example)', null, 'Placeholder service summary.', null, 'Who it''s for (example).', null, 'Deliverables (example).', null, 'Stages (example).'),
  ('de5eed00-0000-4000-8000-000000000505', 'arabic-only-service', 'de5eed00-0000-4000-8000-000000000401', false, 4, 'published', 'خدمة بالعربية فقط (مثال)', null, 'ملخص تجريبي للخدمة.', null, 'الجهات المستفيدة (مثال).', null, 'المخرجات (مثال).', null, 'المراحل (مثال).', null),
  ('de5eed00-0000-4000-8000-000000000506', 'draft-service', 'de5eed00-0000-4000-8000-000000000402', false, 5, 'draft', 'خدمة مسودة', 'Draft service', 'ملخص تجريبي للخدمة.', 'Placeholder service summary.', 'الجهات المستفيدة (مثال).', 'Who it''s for (example).', 'المخرجات (مثال).', 'Deliverables (example).', 'المراحل (مثال).', 'Stages (example).')
on conflict (id) do update set slug = excluded.slug, expertise_id = excluded.expertise_id, is_featured = excluded.is_featured, position = excluded.position, status = excluded.status, title_ar = excluded.title_ar, title_en = excluded.title_en, summary_ar = excluded.summary_ar, summary_en = excluded.summary_en, audience_ar = excluded.audience_ar, audience_en = excluded.audience_en, deliverables_ar = excluded.deliverables_ar, deliverables_en = excluded.deliverables_en, stages_ar = excluded.stages_ar, stages_en = excluded.stages_en;

insert into public.projects (id, slug, expertise_id, org_type, title_ar, title_en, org_name_ar, org_name_en, org_label_ar, org_label_en, hide_org_name, goal_ar, goal_en, role_ar, role_en, duration_ar, duration_en, activities_ar, activities_en, results_ar, results_en, key_result_ar, key_result_en, is_featured, status) values
  ('de5eed00-0000-4000-8000-000000000601', 'example-governance-project', 'de5eed00-0000-4000-8000-000000000401', 'government', 'مشروع حوكمة تجريبي', 'Example governance project', 'جهة مثال', 'Example Org', null, null, false, 'هدف تجريبي للمشروع.', 'Placeholder project goal.', 'الدور (مثال).', 'Role (example).', 'ستة أشهر', 'Six months', 'أنشطة تجريبية.', 'Placeholder activities.', 'نتائج تجريبية بالأرقام.', 'Placeholder results in numbers.', 'تحسن بنسبة 30٪ (مثال)', '30% improvement (example)', true, 'published'),
  ('de5eed00-0000-4000-8000-000000000602', 'example-hidden-org-project', 'de5eed00-0000-4000-8000-000000000403', 'organization', 'مشروع لجهة مخفية (مثال)', 'Project for a hidden organization (example)', 'اسم جهة تجريبي يجب ألا يظهر', 'Example Hidden Org Name That Must Not Show', 'منظمة دولية', 'An international organization', true, 'هدف تجريبي للمشروع.', 'Placeholder project goal.', 'الدور (مثال).', 'Role (example).', 'ستة أشهر', 'Six months', 'أنشطة تجريبية.', 'Placeholder activities.', 'نتائج تجريبية بالأرقام.', 'Placeholder results in numbers.', 'تحسن بنسبة 30٪ (مثال)', '30% improvement (example)', true, 'published'),
  ('de5eed00-0000-4000-8000-000000000603', 'example-private-sector-project', 'de5eed00-0000-4000-8000-000000000402', 'company', 'مشروع قطاع خاص تجريبي', 'Example private sector project', 'شركة مثال', 'Example Company', null, null, false, 'هدف تجريبي للمشروع.', 'Placeholder project goal.', 'الدور (مثال).', 'Role (example).', 'ستة أشهر', 'Six months', 'أنشطة تجريبية.', 'Placeholder activities.', 'نتائج تجريبية بالأرقام.', 'Placeholder results in numbers.', 'تحسن بنسبة 30٪ (مثال)', '30% improvement (example)', true, 'published'),
  ('de5eed00-0000-4000-8000-000000000604', 'draft-project', 'de5eed00-0000-4000-8000-000000000402', 'company', 'مشروع مسودة', 'Draft project', 'جهة مثال', 'Example Org', null, null, false, 'هدف تجريبي للمشروع.', 'Placeholder project goal.', 'الدور (مثال).', 'Role (example).', 'ستة أشهر', 'Six months', 'أنشطة تجريبية.', 'Placeholder activities.', 'نتائج تجريبية بالأرقام.', 'Placeholder results in numbers.', 'تحسن بنسبة 30٪ (مثال)', '30% improvement (example)', false, 'draft')
on conflict (id) do update set slug = excluded.slug, expertise_id = excluded.expertise_id, org_type = excluded.org_type, title_ar = excluded.title_ar, title_en = excluded.title_en, org_name_ar = excluded.org_name_ar, org_name_en = excluded.org_name_en, org_label_ar = excluded.org_label_ar, org_label_en = excluded.org_label_en, hide_org_name = excluded.hide_org_name, goal_ar = excluded.goal_ar, goal_en = excluded.goal_en, role_ar = excluded.role_ar, role_en = excluded.role_en, duration_ar = excluded.duration_ar, duration_en = excluded.duration_en, activities_ar = excluded.activities_ar, activities_en = excluded.activities_en, results_ar = excluded.results_ar, results_en = excluded.results_en, key_result_ar = excluded.key_result_ar, key_result_en = excluded.key_result_en, is_featured = excluded.is_featured, status = excluded.status;

-- No project_images: a row needs a real file, and the gallery is tested with fixtures.
-- This removes the row an earlier version of the seed added.
delete from public.project_images where id = 'de5eed00-0000-4000-8000-000000000651';

insert into public.project_services (project_id, service_id) values
  ('de5eed00-0000-4000-8000-000000000601', 'de5eed00-0000-4000-8000-000000000501'),
  ('de5eed00-0000-4000-8000-000000000602', 'de5eed00-0000-4000-8000-000000000503'),
  ('de5eed00-0000-4000-8000-000000000603', 'de5eed00-0000-4000-8000-000000000502')
on conflict (project_id, service_id) do nothing;

insert into public.faqs (id, category, service_id, question_ar, question_en, answer_ar, answer_en, position, status) values
  ('de5eed00-0000-4000-8000-000000000701', 'consultations', null, 'كيف أطلب استشارة؟ (مثال)', 'How do I request a consultation? (example)', 'إجابة تجريبية.', 'Placeholder answer.', 0, 'published'),
  ('de5eed00-0000-4000-8000-000000000702', 'documents', null, 'كيف أطلب الاطلاع على وثيقة؟ (مثال)', 'How do I request to view a document? (example)', 'إجابة تجريبية.', 'Placeholder answer.', 1, 'published'),
  ('de5eed00-0000-4000-8000-000000000703', 'account', null, 'هل يمكنني تغيير لغة الحساب؟ (مثال)', 'Can I change my account language? (example)', 'إجابة تجريبية.', 'Placeholder answer.', 2, 'published'),
  ('de5eed00-0000-4000-8000-000000000704', 'training', null, null, 'English-only question (example)', null, 'Placeholder answer.', 3, 'published'),
  ('de5eed00-0000-4000-8000-000000000705', 'consultations', 'de5eed00-0000-4000-8000-000000000501', 'ماذا تشمل مراجعة الحوكمة؟ (مثال)', 'What does a governance review include? (example)', 'إجابة تجريبية.', 'Placeholder answer.', 4, 'published'),
  ('de5eed00-0000-4000-8000-000000000706', 'account', null, 'سؤال مسودة', 'Draft question', 'مسودة', 'Draft', 5, 'draft')
on conflict (id) do update set category = excluded.category, service_id = excluded.service_id, question_ar = excluded.question_ar, question_en = excluded.question_en, answer_ar = excluded.answer_ar, answer_en = excluded.answer_en, position = excluded.position, status = excluded.status;

insert into public.partners (id, name_ar, name_en, logo_path, consent_confirmed, admin_approved, position, status) values
  ('de5eed00-0000-4000-8000-000000000801', 'جهة مثال أ', 'Example Org A', null, true, true, 0, 'published'),
  ('de5eed00-0000-4000-8000-000000000802', 'جهة مثال ب', 'Example Org B', null, true, true, 1, 'published'),
  ('de5eed00-0000-4000-8000-000000000803', 'جهة بلا موافقة (مثال)', 'Example Org Without Consent', null, false, true, 2, 'published'),
  ('de5eed00-0000-4000-8000-000000000804', 'جهة بلا اعتماد (مثال)', 'Example Org Not Approved', null, true, false, 3, 'published'),
  ('de5eed00-0000-4000-8000-000000000805', 'جهة مسودة (مثال)', 'Example Draft Org', null, true, true, 4, 'draft')
on conflict (id) do update set name_ar = excluded.name_ar, name_en = excluded.name_en, logo_path = excluded.logo_path, consent_confirmed = excluded.consent_confirmed, admin_approved = excluded.admin_approved, position = excluded.position, status = excluded.status;

insert into public.testimonials (id, quote_ar, quote_en, author_ar, author_en, partner_id, letter_path, consent_confirmed, admin_approved, position, status) values
  ('de5eed00-0000-4000-8000-000000000901', 'اقتباس تجريبي معتمد، لا يمثل رأيًا حقيقيًا.', 'An approved placeholder quote, not a real opinion.', 'مثال، مدير برامج', 'Example, program manager', 'de5eed00-0000-4000-8000-000000000801', 'dev-seed/no-file-letter-1.pdf', true, true, 0, 'published'),
  ('de5eed00-0000-4000-8000-000000000902', 'اقتباس تجريبي ثانٍ معتمد.', 'A second approved placeholder quote.', 'مثال، مسؤول', 'Example, officer', 'de5eed00-0000-4000-8000-000000000802', 'dev-seed/no-file-letter-2.pdf', true, true, 1, 'published'),
  ('de5eed00-0000-4000-8000-000000000903', 'اقتباس بلا موافقة على النشر، يجب ألا يظهر.', 'A quote without publishing consent; it must not show.', 'مثال', 'Example', null, 'dev-seed/no-file-letter-3.pdf', false, true, 2, 'published'),
  ('de5eed00-0000-4000-8000-000000000904', 'اقتباس بلا اعتماد المدير، يجب ألا يظهر.', 'A quote without admin approval; it must not show.', 'مثال', 'Example', null, 'dev-seed/no-file-letter-4.pdf', true, false, 3, 'published'),
  ('de5eed00-0000-4000-8000-000000000905', 'اقتباس مسودة، يجب ألا يظهر.', 'A draft quote; it must not show.', 'مثال', 'Example', null, 'dev-seed/no-file-letter-5.pdf', true, true, 4, 'draft')
on conflict (id) do update set quote_ar = excluded.quote_ar, quote_en = excluded.quote_en, author_ar = excluded.author_ar, author_en = excluded.author_en, partner_id = excluded.partner_id, letter_path = excluded.letter_path, consent_confirmed = excluded.consent_confirmed, admin_approved = excluded.admin_approved, position = excluded.position, status = excluded.status;

insert into public.posts (id, slug_ar, slug_en, expertise_id, title_ar, title_en, excerpt_ar, excerpt_en, body_ar, body_en, reading_minutes_ar, reading_minutes_en, published_at, status) values
  ('de5eed00-0000-4000-8000-000000001001', 'مقال-تجريبي', 'example-article', 'de5eed00-0000-4000-8000-000000000401', 'مقال تجريبي عن الحوكمة', 'Example article on governance', 'مقتطف تجريبي.', 'Placeholder excerpt.', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "نص تجريبي للمقال."}]}]}'::jsonb, '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Placeholder article text."}]}]}'::jsonb, 4, 4, '2026-10-01T09:00:00Z', 'published'),
  ('de5eed00-0000-4000-8000-000000001002', 'مقال-بالعربية-فقط', null, 'de5eed00-0000-4000-8000-000000000403', 'مقال بالعربية فقط (مثال)', null, 'مقتطف تجريبي.', null, '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "نص تجريبي."}]}]}'::jsonb, null, 3, null, '2026-10-15T09:00:00Z', 'published'),
  ('de5eed00-0000-4000-8000-000000001003', 'مقال-مسودة', 'draft-article', null, 'مقال مسودة', 'Draft article', null, null, '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "مسودة"}]}]}'::jsonb, '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Draft"}]}]}'::jsonb, null, null, null, 'draft')
on conflict (id) do update set slug_ar = excluded.slug_ar, slug_en = excluded.slug_en, expertise_id = excluded.expertise_id, title_ar = excluded.title_ar, title_en = excluded.title_en, excerpt_ar = excluded.excerpt_ar, excerpt_en = excluded.excerpt_en, body_ar = excluded.body_ar, body_en = excluded.body_en, reading_minutes_ar = excluded.reading_minutes_ar, reading_minutes_en = excluded.reading_minutes_en, published_at = excluded.published_at, status = excluded.status;

insert into public.resources (id, expertise_id, kind, title_ar, title_en, description_ar, description_en, storage_key, access, status) values
  ('de5eed00-0000-4000-8000-000000001101', 'de5eed00-0000-4000-8000-000000000401', 'guide', 'دليل تجريبي', 'Example guide', 'وصف تجريبي.', 'Placeholder description.', 'dev-seed/no-file-guide.pdf', 'email', 'published'),
  ('de5eed00-0000-4000-8000-000000001102', 'de5eed00-0000-4000-8000-000000000402', 'template', 'نموذج تجريبي', 'Example template', null, null, 'dev-seed/no-file-template.docx', 'direct', 'published'),
  ('de5eed00-0000-4000-8000-000000001103', null, 'working_paper', 'ورقة مسودة', 'Draft paper', null, null, 'dev-seed/no-file-draft.pdf', 'direct', 'draft')
on conflict (id) do update set expertise_id = excluded.expertise_id, kind = excluded.kind, title_ar = excluded.title_ar, title_en = excluded.title_en, description_ar = excluded.description_ar, description_en = excluded.description_en, storage_key = excluded.storage_key, access = excluded.access, status = excluded.status;

insert into public.media_items (id, category, title_ar, title_en, outlet_ar, outlet_en, date, url, status) values
  ('de5eed00-0000-4000-8000-000000001201', 'events', 'مشاركة تجريبية في مؤتمر', 'Example conference talk', 'مؤتمر مثال', 'Example Conference', '2026-09-20', 'https://example.com/event', 'published'),
  ('de5eed00-0000-4000-8000-000000001202', 'media', 'مقابلة تجريبية', 'Example interview', 'قناة مثال', 'Example Channel', '2026-08-05', null, 'published'),
  ('de5eed00-0000-4000-8000-000000001203', 'media', 'ظهور مسودة', 'Draft appearance', null, null, null, null, 'draft')
on conflict (id) do update set category = excluded.category, title_ar = excluded.title_ar, title_en = excluded.title_en, outlet_ar = excluded.outlet_ar, outlet_en = excluded.outlet_en, date = excluded.date, url = excluded.url, status = excluded.status;

insert into public.courses (id, slug, type, title_ar, title_en, description_ar, description_en, audience_ar, audience_en, starts_at, place_ar, place_en, seats, status, online_url) values
  ('de5eed00-0000-4000-8000-000000001301', 'example-governance-course', 'in_person', 'دورة تجريبية في الحوكمة', 'Example governance course', 'وصف تجريبي.', 'Placeholder description.', 'المديرون (مثال)', 'Managers (example)', '2026-12-10T07:00:00Z', 'مدينة مثال', 'Example City', 20, 'published', null),
  ('de5eed00-0000-4000-8000-000000001302', 'example-recorded-course', 'recorded', 'دورة مسجلة تجريبية', 'Example recorded course', 'وصف تجريبي.', 'Placeholder description.', null, null, null, null, null, null, 'published', 'https://example.com/course'),
  ('de5eed00-0000-4000-8000-000000001303', 'draft-course', 'online_live', 'دورة مسودة', 'Draft course', null, null, null, null, null, null, null, null, 'draft', null)
on conflict (id) do update set slug = excluded.slug, type = excluded.type, title_ar = excluded.title_ar, title_en = excluded.title_en, description_ar = excluded.description_ar, description_en = excluded.description_en, audience_ar = excluded.audience_ar, audience_en = excluded.audience_en, starts_at = excluded.starts_at, place_ar = excluded.place_ar, place_en = excluded.place_en, seats = excluded.seats, status = excluded.status, online_url = excluded.online_url;

insert into public.documents (id, category, title_ar, title_en, storage_key, mime, access_mode, status) values
  ('de5eed00-0000-4000-8000-000000001401', 'thank_you_letter', 'خطاب شكر تجريبي من جهة مثال', 'Example thank-you letter from Example Org', 'dev-seed/no-file-1401.pdf', 'application/pdf', 'view', 'published'),
  ('de5eed00-0000-4000-8000-000000001402', 'course_certificate', 'شهادة دورة تجريبية', 'Example course certificate', 'dev-seed/no-file-1402.pdf', 'application/pdf', 'view_download', 'published'),
  ('de5eed00-0000-4000-8000-000000001403', 'qualification_certificate', 'شهادة مؤهل تجريبية', 'Example qualification certificate', 'dev-seed/no-file-1403.pdf', 'application/pdf', 'view', 'published'),
  ('de5eed00-0000-4000-8000-000000001404', 'recommendation_letter', 'خطاب توصية تجريبي', 'Example recommendation letter', 'dev-seed/no-file-1404.pdf', 'application/pdf', 'view', 'published'),
  ('de5eed00-0000-4000-8000-000000001405', 'experience_certificate', 'شهادة خبرة تجريبية', 'Example experience certificate', 'dev-seed/no-file-1405.pdf', 'application/pdf', 'view', 'published'),
  ('de5eed00-0000-4000-8000-000000001406', 'project_photo', 'صور مشروع تجريبي', 'Example project photos', 'dev-seed/no-file-1406.pdf', 'application/pdf', 'view_download', 'published'),
  ('de5eed00-0000-4000-8000-000000001407', 'event_photo', 'وثيقة مسودة', 'Draft document', 'dev-seed/no-file-1407.jpg', 'image/jpeg', 'view', 'draft')
on conflict (id) do update set category = excluded.category, title_ar = excluded.title_ar, title_en = excluded.title_en, storage_key = excluded.storage_key, mime = excluded.mime, access_mode = excluded.access_mode, status = excluded.status;

commit;
