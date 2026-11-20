-- Phase 8: Ahmed's letter, a home section right after the hero (§6.2).
-- The row is seeded hidden and draft: the deployed home reader parses every
-- published, visible key, so it must not see 'letter' until its code ships.
-- The text is the placeholder from docs/design/letter-placeholder.md; the
-- product owner replaces it, and adds the signatures, before launch.
-- RLS and grants on home_sections stay as they are.

alter table public.home_sections drop constraint home_sections_key_check;
alter table public.home_sections add constraint home_sections_key_check check (key in (
  'hero', 'letter', 'stats', 'expertise', 'audiences', 'services', 'projects',
  'partners', 'testimonials', 'media', 'latest', 'newsletter', 'contact'
));

update public.home_sections set position = position + 1 where position >= 2;

insert into public.home_sections (key, position, is_visible, status, content_ar, content_en)
values (
  'letter',
  2,
  false,
  'draft',
  jsonb_build_object(
    'heading', 'رسالة إلى من يزور هذه الصفحة',
    'salutation', 'إلى من يقرأ هذا،',
    'paragraphs', jsonb_build_array(
      'عملتُ سنواتٍ طويلة مع وزارات ومنظمات وشركات، وفي أماكن كان القرار فيها صعباً على الجميع. تعلّمت أن أغلب المؤسسات لا ينقصها الخبراء، بل ينقصها وقتٌ هادئ تسمع فيه نفسها.',
      'هذا ما أحاول أن أقدّمه: أن أجلس معكم، وأسمع، ثم أكتب معكم ما يمكن تنفيذه والدفاع عنه. ستجد هنا المشاريع كما حدثت، والوثائق التي تثبتها، وكلامي بصوتي.',
      'إن كان عندك ما يقلقك، فاكتب لي. سأقرأ رسالتك بنفسي.'
    ),
    'signOff', 'أحمد الزبيري',
    'isPlaceholder', true
  ),
  jsonb_build_object(
    'heading', 'A letter to whoever is reading this',
    'salutation', 'To whoever is reading this,',
    'paragraphs', jsonb_build_array(
      'For many years I have worked with ministries, organizations and companies, often in places where every decision was hard. I learned that most institutions are not short of experts. They are short of quiet time to hear themselves.',
      'That is what I try to offer: to sit with you, listen, and then write with you something you can carry out and defend. You will find the projects here as they happened, the documents behind them, and my own words.',
      'If something is worrying you, write to me. I read every message myself.'
    ),
    'signOff', 'Ahmed Alzubairi',
    'isPlaceholder', true
  )
);
