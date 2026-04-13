-- Normalize persisted display title/description for world-around-me methodology.
update public.methodology
set
  title = 'Мир вокруг меня – 我周围的世界',
  short_description = 'Китайский для детей 5–6 лет, 45-минутные занятия с песнями, видео и активной игровой практикой.',
  metadata = jsonb_set(
    jsonb_set(coalesce(metadata, '{}'::jsonb), '{titleRu}', to_jsonb('Мир вокруг меня'::text), true),
    '{titleNative}',
    to_jsonb('我周围的世界'::text),
    true
  )
where slug = 'world-around-me';
