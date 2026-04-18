begin;

insert into public.reusable_asset (kind, slug, title, description, source_url, file_ref, metadata)
values
  ('presentation', 'presentation:world-around-me-lesson-1', 'Презентация урока 1', 'Локальная презентация урока 1 для проведения и демонстрации слайдов.', 'https://docs.google.com/presentation/d/1o-LCuePhdVq39oBPqHgtHpJUREJNz4dS/edit?usp=drive_link&ouid=102261836036017130249&rtpof=true&sd=true', '/methodologies/world-around-me/lesson-1/presentation/lesson-1-slides.pdf', '{"pptxFileRef":"/methodologies/world-around-me/lesson-1/presentation/lesson-1-slides.pptx","slideImageRefs":["/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-01.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-02.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-03.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-04.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-05.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-06.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-07.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-08.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-09.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-10.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-11.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-12.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-13.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-14.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-15.png","/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-16.png"]}'::jsonb),
  ('flashcards_pdf', 'flashcards:world-around-me-lesson-1', 'Карточки урока 1 (PDF)', 'Карточки для работы на уроке 1', 'https://drive.google.com/file/d/11LTKea4ui3_xB5ZBc6WbEanwlxfoO_GY/view?usp=drive_link', '/methodologies/world-around-me/lesson-1/flashcards/lesson-1-flashcards.pdf', '{"cardImageRefs":["/methodologies/world-around-me/lesson-1/flashcards/dog-card.png","/methodologies/world-around-me/lesson-1/flashcards/dog-card_2.png","/methodologies/world-around-me/lesson-1/flashcards/cat-card.png","/methodologies/world-around-me/lesson-1/flashcards/cat-card_2.png","/methodologies/world-around-me/lesson-1/flashcards/rabbit-card.png","/methodologies/world-around-me/lesson-1/flashcards/rabbit-card_2.png","/methodologies/world-around-me/lesson-1/flashcards/horse-card.png","/methodologies/world-around-me/lesson-1/flashcards/horse-card_2.png","/methodologies/world-around-me/lesson-1/flashcards/farm-card.png","/methodologies/world-around-me/lesson-1/flashcards/farm-card_2.png"]}'::jsonb),
  ('worksheet_pdf', 'worksheet:appendix-1', 'Приложение 1', 'Материал для счёта и указки.', 'https://drive.google.com/file/d/1hNwwBZ0S7SNmSbAAt-vz1aPanAluSTrC/view?usp=drive_link', '/methodologies/world-around-me/lesson-1/appendix/appendix-1.pdf', '{"previewImageRef":"/methodologies/world-around-me/lesson-1/appendix/appendix-1.png"}'::jsonb),
  ('worksheet', 'worksheet:workbook-pages-3-4', 'Рабочая тетрадь, стр. 3–4', 'Закрепление урока 1.', 'https://drive.google.com/file/d/1bS3KP_wRQSrAu9faPhyqkNdxeTul9bi0/view?usp=drive_link', null, '{}'::jsonb),
  ('video', 'video:farm-animals', 'farm animals', 'Видео урока 1.', 'https://drive.google.com/file/d/1NXyngOuT9WIwvgA0gvvSzZc9-BUuKT7k/view?usp=drive_link', null, '{}'::jsonb),
  ('song_audio', 'song:farm-animals', 'farm animals', 'Песня урока 1.', 'https://drive.google.com/file/d/1RewHJRdd6oqSfX506A7ABt6VMDhDzJRP/view?usp=drive_link', '/methodologies/world-around-me/lesson-1/media/farm-animals-song.mp3', '{}'::jsonb),
  ('song_video', 'song-video:farm-animals-movement', 'farm animals (movement version)', 'Видео-версия песни с движением.', 'https://drive.google.com/file/d/1RdZLmZHFnxflYuYkSNvhclrfYuNxAnSC/view?usp=drive_link', '/methodologies/world-around-me/lesson-1/media/farm-animals-song-video.mp4', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:dog', '狗 · gǒu', null, null, '/methodologies/world-around-me/lesson-1/audio/gou.mp3', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:cat', '猫 · māo', null, null, '/methodologies/world-around-me/lesson-1/audio/mao.mp3', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:rabbit', '兔子 · tùzi', null, null, '/methodologies/world-around-me/lesson-1/audio/tuzi.mp3', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:horse', '马 · mǎ', null, null, '/methodologies/world-around-me/lesson-1/audio/ma.mp3', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:farm', '农场 · nóngchǎng', null, null, '/methodologies/world-around-me/lesson-1/audio/nongchang.mp3', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:wo-shi', '我是… · wǒ shì…', null, null, '/methodologies/world-around-me/lesson-1/audio/woshi.mp3', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:zhe-shi', '这是… · zhè shì…', null, null, '/methodologies/world-around-me/lesson-1/audio/zheshi.mp3', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:run', '跑 · pǎo', null, null, '/methodologies/world-around-me/lesson-1/audio/pao.mp3', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:jump', '跳 · tiào', null, null, '/methodologies/world-around-me/lesson-1/audio/tiao.mp3', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:lets', '我们…吧! · wǒmen … ba!', null, null, '/methodologies/world-around-me/lesson-1/audio/womenba.mp3', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:zai', '在 · zài', null, null, '/methodologies/world-around-me/lesson-1/audio/zai.mp3', '{}'::jsonb)
on conflict (slug)
do update set
  kind = excluded.kind,
  title = excluded.title,
  description = excluded.description,
  source_url = excluded.source_url,
  file_ref = excluded.file_ref,
  metadata = excluded.metadata,
  updated_at = now();

commit;
