begin;

with lesson as (
  select ml.id as methodology_lesson_id
  from public.methodology_lesson ml
  join public.methodology m on m.id = ml.methodology_id
  where m.slug = 'world-around-me'
    and ml.module_index = 1
    and ml.lesson_index = 1
  limit 1
)
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

insert into public.methodology_lesson_homework (
  methodology_lesson_id,
  title,
  kind,
  instructions,
  material_links,
  answer_format_hint,
  estimated_minutes,
  quiz_payload
)
with lesson as (
  select ml.id as methodology_lesson_id
  from public.methodology_lesson ml
  join public.methodology m on m.id = ml.methodology_id
  where m.slug = 'world-around-me'
    and ml.module_index = 1
    and ml.lesson_index = 1
  limit 1
)
select
  lesson.methodology_lesson_id,
  'Практика дома: ферма, слова и команды',
  'quiz_single_choice',
  'Сначала сопоставь животных и иероглифы, затем повтори слова с аудио, и после этого пройди короткий квиз.',
  '["Рабочая тетрадь, стр. 3–4", "Карточки животных", "Презентация урока 1"]'::jsonb,
  'Интерактивная практика + квиз из 5 вопросов.',
  10,
  '{"id":"world-around-me-lesson-1-quiz","version":2,"title":"Домашняя мини-миссия: Животные на ферме","subtitle":"Сопоставь, послушай, затем выбери правильный вариант.","introText":"Повтори слова урока вместе с карточками и аудио.","completionTitle":"Отличная работа!","completionText":"Ты повторил(а) слова, команды и фразы урока 1.","practiceSections":[{"id":"matching-l1","type":"matching","title":"Соедини картинку и иероглиф","prompt":"Перетащи слово к правильной карточке животного.","items":[{"id":"dog","label":"狗","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/dog-card.png"},{"id":"cat","label":"猫","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/cat-card.png"},{"id":"rabbit","label":"兔子","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/rabbit-card.png"},{"id":"horse","label":"马","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/horse-card.png"}]},{"id":"audio-review-l1","type":"audio_review","title":"Слушай и повторяй слова","groups":[{"id":"animals","title":"Животные и ферма","entries":[{"id":"狗","hanzi":"狗","pinyin":"gǒu","meaning":"собака","audioAssetId":"pronunciation:dog","audioUrl":"/methodologies/world-around-me/lesson-1/audio/gou.mp3"},{"id":"猫","hanzi":"猫","pinyin":"māo","meaning":"кошка","audioAssetId":"pronunciation:cat","audioUrl":"/methodologies/world-around-me/lesson-1/audio/mao.mp3"},{"id":"兔子","hanzi":"兔子","pinyin":"tùzi","meaning":"кролик","audioAssetId":"pronunciation:rabbit","audioUrl":"/methodologies/world-around-me/lesson-1/audio/tuzi.mp3"},{"id":"马","hanzi":"马","pinyin":"mǎ","meaning":"лошадь","audioAssetId":"pronunciation:horse","audioUrl":"/methodologies/world-around-me/lesson-1/audio/ma.mp3"},{"id":"农场","hanzi":"农场","pinyin":"nóngchǎng","meaning":"ферма","audioAssetId":"pronunciation:farm","audioUrl":"/methodologies/world-around-me/lesson-1/audio/nongchang.mp3"}]},{"id":"phrases-actions","title":"Фразы, действия и грамматика","entries":[{"id":"我是","hanzi":"我是…","pinyin":"wǒ shì…","meaning":"Я…","audioAssetId":"pronunciation:wo-shi","audioUrl":"/methodologies/world-around-me/lesson-1/audio/woshi.mp3"},{"id":"这是","hanzi":"这是…","pinyin":"zhè shì…","meaning":"Это…","audioAssetId":"pronunciation:zhe-shi","audioUrl":"/methodologies/world-around-me/lesson-1/audio/zheshi.mp3"},{"id":"跑","hanzi":"跑","pinyin":"pǎo","meaning":"бежать","audioAssetId":"pronunciation:run","audioUrl":"/methodologies/world-around-me/lesson-1/audio/pao.mp3"},{"id":"跳","hanzi":"跳","pinyin":"tiào","meaning":"прыгать","audioAssetId":"pronunciation:jump","audioUrl":"/methodologies/world-around-me/lesson-1/audio/tiao.mp3"},{"id":"我们吧","hanzi":"我们…吧!","pinyin":"wǒmen … ba!","meaning":"Давайте…!","audioAssetId":"pronunciation:lets","audioUrl":"/methodologies/world-around-me/lesson-1/audio/womenba.mp3"},{"id":"在","hanzi":"在","pinyin":"zài","meaning":"в / внутри","audioAssetId":"pronunciation:zai","audioUrl":"/methodologies/world-around-me/lesson-1/audio/zai.mp3"}]}]}],"questions":[{"id":"q1","prompt":"Как по-китайски «собака»?","helperText":"Выбери карточку со словом.","options":[{"id":"a","label":"狗"},{"id":"b","label":"猫"},{"id":"c","label":"马"}],"correctOptionId":"a"},{"id":"q2","prompt":"Как по-китайски «кролик»?","options":[{"id":"a","label":"兔子"},{"id":"b","label":"农场"},{"id":"c","label":"狗"}],"correctOptionId":"a"},{"id":"q3","prompt":"Что значит «农场»?","options":[{"id":"a","label":"кошка"},{"id":"b","label":"ферма"},{"id":"c","label":"лошадь"}],"correctOptionId":"b"},{"id":"q4","prompt":"Выбери фразу «Это…»","options":[{"id":"a","label":"我是…"},{"id":"b","label":"这是…"},{"id":"c","label":"我们…吧！"}],"correctOptionId":"b"},{"id":"q5","prompt":"Какое слово значит «прыгать»?","options":[{"id":"a","label":"跑"},{"id":"b","label":"在"},{"id":"c","label":"跳"}],"correctOptionId":"c"}]}'::jsonb
from lesson
on conflict (methodology_lesson_id)
do update set
  title = excluded.title,
  kind = excluded.kind,
  instructions = excluded.instructions,
  material_links = excluded.material_links,
  answer_format_hint = excluded.answer_format_hint,
  estimated_minutes = excluded.estimated_minutes,
  quiz_payload = excluded.quiz_payload,
  updated_at = now();

insert into public.methodology_lesson_student_content (
  methodology_lesson_id,
  title,
  subtitle,
  content_payload
)
with lesson as (
  select ml.id as methodology_lesson_id
  from public.methodology_lesson ml
  join public.methodology m on m.id = ml.methodology_id
  where m.slug = 'world-around-me'
    and ml.module_index = 1
    and ml.lesson_index = 1
  limit 1
)
select
  lesson.methodology_lesson_id,
  'Урок 1. Животные на ферме',
  'Полноценный урок-хаб: презентация, карточки, счёт, движение, ферма и практика.',
  '{"sections":[{"type":"lesson_focus","title":"Урок 1 · Животные на ферме","subtitle":"Сяо Лон и Сяо Мей приглашают в фермерское приключение.","body":"Поздороваемся, посмотрим презентацию, потренируем слова и команды, поработаем с приложением 1 и закрепим урок песней.","chips":["狗","猫","兔子","马","农场"],"tone":"sky","layout":"hero","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/hero-farm.png","sceneId":"scene-hero"},{"type":"presentation","title":"Презентация урока","subtitle":"Онлайн-версия для просмотра во время занятия.","tone":"sky","layout":"presentation","sceneId":"scene-presentation","assetId":"presentation:world-around-me-lesson-1","readOnly":true,"studentCtaLabel":"Открыть слайды","note":"Материал только для просмотра. Скачать презентацию можно в кабинете преподавателя."},{"type":"vocabulary_cards","title":"Большие карточки слов","subtitle":"Листай карточки, слушай и повторяй.","tone":"amber","layout":"vocabulary","sceneId":"scene-flashcards","displayMode":"carousel","items":[{"term":"狗","pinyin":"gǒu","meaning":"собака","visualHint":"Скажи: 这是狗。","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/dog-card.png","audioAssetId":"pronunciation:dog"},{"term":"猫","pinyin":"māo","meaning":"кошка","visualHint":"Покажи мягкие лапки.","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/cat-card.png","audioAssetId":"pronunciation:cat"},{"term":"兔子","pinyin":"tùzi","meaning":"кролик","visualHint":"Прыгни как кролик.","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/rabbit-card.png","audioAssetId":"pronunciation:rabbit"},{"term":"马","pinyin":"mǎ","meaning":"лошадь","visualHint":"Покажи, как скачет лошадка.","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/horse-card.png","audioAssetId":"pronunciation:horse"},{"term":"农场","pinyin":"nóngchǎng","meaning":"ферма","visualHint":"Покажи ферму на картинке.","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/farm-barn.png","audioAssetId":"pronunciation:farm"}]},{"type":"phrase_cards","title":"Диалог Сяо Лона и Сяо Мей","subtitle":"Повторяем ключевые фразы урока.","tone":"violet","layout":"phrases","sceneId":"scene-phrases","displayMode":"dialogue","items":[{"phrase":"你是谁？","pinyin":"nǐ shì shéi?","meaning":"Кто ты?","speaker":"Сяо Лон"},{"phrase":"我是…","pinyin":"wǒ shì…","meaning":"Я…","speaker":"Сяо Мей","example":"我是小猫。","audioAssetId":"pronunciation:wo-shi"},{"phrase":"这是…","pinyin":"zhè shì…","meaning":"Это…","speaker":"Сяо Лон","example":"这是狗。","audioAssetId":"pronunciation:zhe-shi"}]},{"type":"count_board","title":"Приложение 1: считаем и называем","subtitle":"Нажимай группы и проговаривай число + животное.","tone":"sky","layout":"counting","sceneId":"scene-counting","prompt":"Покажи группу, посчитай животных и назови их вслух.","assetId":"worksheet:appendix-1","groups":[{"id":"g1","label":"1 × 狗","count":1,"cue":"一只狗"},{"id":"g2","label":"2 × 猫","count":2,"cue":"两只猫"},{"id":"g3","label":"3 × 兔子","count":3,"cue":"三只兔子"},{"id":"g4","label":"4 × 马","count":4,"cue":"四匹马"},{"id":"g5","label":"5 × 动物","count":5,"cue":"五只动物"}]},{"type":"action_cards","title":"Движение и команды","subtitle":"Мини-дрилл по действиям и командам.","tone":"emerald","layout":"movement","sceneId":"scene-actions","displayMode":"slider","items":[{"term":"跑","pinyin":"pǎo","meaning":"бежать","movementHint":"Побежали вместе по команде.","commandExample":"我们跑吧！ / 跑到狗！","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/run-action.png","audioAssetId":"pronunciation:run"},{"term":"跳","pinyin":"tiào","meaning":"прыгать","movementHint":"Прыгаем на месте и к карточке.","commandExample":"我们跳吧！ / 跳到兔子！","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/jump-action.png","audioAssetId":"pronunciation:jump"},{"term":"我们…吧!","pinyin":"wǒmen … ba!","meaning":"Давайте…!","movementHint":"Скажи команду всей группе.","commandExample":"我们跑吧！","audioAssetId":"pronunciation:lets"}]},{"type":"farm_placement","title":"Кто живёт на ферме","subtitle":"Выбери животное и собери фразу с 在…里.","tone":"amber","layout":"farm","sceneId":"scene-farm","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/farm-barn.png","targetPhraseTemplate":"{animal} 在{zone}。","defaultZoneLabel":"农场里","animals":[{"id":"dog","hanzi":"狗","pinyin":"gǒu","meaning":"собака"},{"id":"cat","hanzi":"猫","pinyin":"māo","meaning":"кошка"},{"id":"rabbit","hanzi":"兔子","pinyin":"tùzi","meaning":"кролик"},{"id":"horse","hanzi":"马","pinyin":"mǎ","meaning":"лошадь"}]},{"type":"word_list","title":"Новые слова и фразы","subtitle":"Повтор перед домашней практикой.","tone":"neutral","layout":"recap","sceneId":"scene-review","groups":[{"id":"animals","title":"Животные и ферма","entries":[{"hanzi":"狗","pinyin":"gǒu","meaning":"собака","audioAssetId":"pronunciation:dog"},{"hanzi":"猫","pinyin":"māo","meaning":"кошка","audioAssetId":"pronunciation:cat"},{"hanzi":"兔子","pinyin":"tùzi","meaning":"кролик","audioAssetId":"pronunciation:rabbit"},{"hanzi":"马","pinyin":"mǎ","meaning":"лошадь","audioAssetId":"pronunciation:horse"},{"hanzi":"农场","pinyin":"nóngchǎng","meaning":"ферма","audioAssetId":"pronunciation:farm"}]},{"id":"phrases","title":"Фразы и действия","entries":[{"hanzi":"我是…","pinyin":"wǒ shì…","meaning":"Я…","audioAssetId":"pronunciation:wo-shi"},{"hanzi":"这是…","pinyin":"zhè shì…","meaning":"Это…","audioAssetId":"pronunciation:zhe-shi"},{"hanzi":"跑","pinyin":"pǎo","meaning":"бежать","audioAssetId":"pronunciation:run"},{"hanzi":"跳","pinyin":"tiào","meaning":"прыгать","audioAssetId":"pronunciation:jump"},{"hanzi":"我们…吧!","pinyin":"wǒmen … ba!","meaning":"давайте…","audioAssetId":"pronunciation:lets"},{"hanzi":"在","pinyin":"zài","meaning":"в / внутри","audioAssetId":"pronunciation:zai"}]}]},{"type":"worksheet","title":"Тетрадь и песня","subtitle":"Финальный блок урока.","tone":"rose","layout":"practice","sceneId":"scene-materials","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/workbook-practice.png","pageLabel":"Рабочая тетрадь · стр. 3–4","instructions":"Раскрась животных, ответь «这是什么？», затем спой песню farm animals. PDF будет добавлен позже — пока открой внешний ресурс.","teacherHint":"После тетради дайте детям 1 минуту на повтор слов перед песней.","assetId":"worksheet:workbook-pages-3-4"},{"type":"resource_links","title":"Материалы урока","subtitle":"Видео, карточки, приложение и песня.","tone":"rose","layout":"resources","sceneId":"scene-materials","audience":"both","resources":[{"id":"video","title":"Видео farm animals","assetId":"video:farm-animals","previewable":true},{"id":"cards","title":"Карточки урока","assetId":"flashcards:world-around-me-lesson-1","downloadable":false},{"id":"appendix","title":"Приложение 1","assetId":"worksheet:appendix-1","previewable":true},{"id":"song","title":"Песня farm animals","assetId":"song:farm-animals","previewable":true}]},{"type":"matching_practice","title":"Практика перед домашним заданием","subtitle":"Сопоставь картинку и слово.","tone":"violet","layout":"homework","sceneId":"scene-homework-practice","prompt":"Перед домашкой потренируйся: найди пару картинка ↔ иероглиф.","pairs":[{"id":"dog","label":"狗","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/dog-card.png"},{"id":"cat","label":"猫","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/cat-card.png"},{"id":"rabbit","label":"兔子","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/rabbit-card.png"},{"id":"horse","label":"马","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/horse-card.png"}]}]}'::jsonb
from lesson
on conflict (methodology_lesson_id)
do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  content_payload = excluded.content_payload,
  updated_at = now();



with lesson_two as (
  select ml.id as methodology_lesson_id
  from public.methodology_lesson ml
  join public.methodology m on m.id = ml.methodology_id
  where m.slug = 'world-around-me'
    and ml.module_index = 1
    and ml.lesson_index = 2
  limit 1
)
update public.methodology_lesson_student_content msc
set content_payload = replace(
  replace(
    msc.content_payload::text,
    '/methodologies/world-around-me/lesson-1/run.svg',
    '/methodologies/world-around-me/lesson-1/visuals/run-action.png'
  ),
  '/methodologies/world-around-me/lesson-1/jump.svg',
  '/methodologies/world-around-me/lesson-1/visuals/jump-action.png'
)::jsonb,
updated_at = now()
from lesson_two
where msc.methodology_lesson_id = lesson_two.methodology_lesson_id;

commit;
