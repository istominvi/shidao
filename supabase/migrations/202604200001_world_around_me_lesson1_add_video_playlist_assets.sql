begin;

insert into public.reusable_asset (kind, slug, title, description, source_url, file_ref, metadata)
values
  ('video', 'video-clip:farm-animals-dog', 'Клип: собака на ферме', 'Короткое видео для шага 1: dog.', null, '/methodologies/world-around-me/lesson-1/media/gou.mp4', '{"scope":"lesson-1-optional-clip"}'::jsonb),
  ('video', 'video-clip:farm-animals-cat', 'Клип: кошка на ферме', 'Короткое видео для шага 1: cat.', null, '/methodologies/world-around-me/lesson-1/media/mao.mp4', '{"scope":"lesson-1-optional-clip"}'::jsonb),
  ('video', 'video-clip:farm-animals-rabbit', 'Клип: кролик на ферме', 'Короткое видео для шага 1: rabbit.', null, '/methodologies/world-around-me/lesson-1/media/tu.mp4', '{"scope":"lesson-1-optional-clip"}'::jsonb),
  ('video', 'video-clip:farm-animals-horse', 'Клип: лошадь на ферме', 'Короткое видео для шага 1: horse.', null, '/methodologies/world-around-me/lesson-1/media/ma.mp4', '{"scope":"lesson-1-optional-clip"}'::jsonb),
  ('video', 'video-clip:farm-animals-pig', 'Клип: свинка на ферме', 'Короткое видео для шага 1: pig.', null, '/methodologies/world-around-me/lesson-1/media/zhu.mp4', '{"scope":"lesson-1-optional-clip"}'::jsonb),
  ('video', 'video-clip:farm-animals-cow', 'Клип: корова на ферме', 'Короткое видео для шага 1: cow.', null, '/methodologies/world-around-me/lesson-1/media/nainiu.mp4', '{"scope":"lesson-1-optional-clip"}'::jsonb),
  ('video', 'video-clip:farm-animals-sheep', 'Клип: овечка на ферме', 'Короткое видео для шага 1: sheep.', null, '/methodologies/world-around-me/lesson-1/media/yang.mp4', '{"scope":"lesson-1-optional-clip"}'::jsonb),
  ('video', 'video-clip:farm-animals-duck', 'Клип: утка на ферме', 'Короткое видео для шага 1: duck.', null, '/methodologies/world-around-me/lesson-1/media/ya.mp4', '{"scope":"lesson-1-optional-clip"}'::jsonb),
  ('video', 'video-clip:farm-animals-chicken', 'Клип: курица на ферме', 'Короткое видео для шага 1: chicken.', null, '/methodologies/world-around-me/lesson-1/media/ji.mp4', '{"scope":"lesson-1-optional-clip"}'::jsonb)
on conflict (slug)
do update set
  kind = excluded.kind,
  title = excluded.title,
  description = excluded.description,
  source_url = excluded.source_url,
  file_ref = excluded.file_ref,
  metadata = excluded.metadata,
  updated_at = now();

update public.reusable_asset
set file_ref = '/methodologies/world-around-me/lesson-1/media/e.mp4',
    updated_at = now()
where slug = 'video:farm-animals'
  and (file_ref is null or file_ref = '');

commit;
