-- Add cover image metadata for teacher-facing methodology cards.
update public.methodology
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{coverImage}',
  jsonb_build_object(
    'src',
    '/methodologies/01.png',
    'alt',
    'Обложка методики «Мир вокруг меня»'
  ),
  true
)
where slug = 'world-around-me';
