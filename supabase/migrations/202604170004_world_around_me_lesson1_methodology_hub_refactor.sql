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
insert into public.reusable_asset (kind, slug, title, description, source_url, metadata)
values
  ('presentation', 'presentation:world-around-me-lesson-1', 'Презентация урока 1', 'Google Slides для урока 1', 'https://docs.google.com/presentation/d/1o-LCuePhdVq39oBPqHgtHpJUREJNz4dS/edit?usp=drive_link&ouid=102261836036017130249&rtpof=true&sd=true', '{}'::jsonb),
  ('flashcards_pdf', 'flashcards:world-around-me-lesson-1', 'Карточки урока 1 (PDF)', 'Карточки для работы на уроке 1', 'https://drive.google.com/file/d/11LTKea4ui3_xB5ZBc6WbEanwlxfoO_GY/view?usp=drive_link', '{}'::jsonb),
  ('worksheet_pdf', 'worksheet:appendix-1', 'Приложение 1', 'Материал для счёта и указки.', 'https://drive.google.com/file/d/1hNwwBZ0S7SNmSbAAt-vz1aPanAluSTrC/view?usp=drive_link', '{}'::jsonb),
  ('worksheet_pdf', 'worksheet:workbook-pages-3-4', 'Рабочая тетрадь, стр. 3–4', 'Закрепление урока 1.', 'https://drive.google.com/file/d/1bS3KP_wRQSrAu9faPhyqkNdxeTul9bi0/view?usp=drive_link', '{}'::jsonb),
  ('lesson_video', 'video:farm-animals', 'farm animals', 'Видео урока 1.', 'https://drive.google.com/file/d/1NXyngOuT9WIwvgA0gvvSzZc9-BUuKT7k/view?usp=drive_link', '{}'::jsonb),
  ('song_audio', 'song:farm-animals', 'farm animals', 'Песня урока 1.', 'https://drive.google.com/file/d/1RewHJRdd6oqSfX506A7ABt6VMDhDzJRP/view?usp=drive_link', '{}'::jsonb),
  ('song_video', 'song-video:farm-animals-movement', 'farm animals (movement version)', 'Видео-версия песни с движением.', 'https://drive.google.com/file/d/1RdZLmZHFnxflYuYkSNvhclrfYuNxAnSC/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:dog', '狗 · gǒu', null, 'https://drive.google.com/file/d/1grQp68jzA-GKI-347k_FCcioEFdpUeIa/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:cat', '猫 · māo', null, 'https://drive.google.com/file/d/1Q-nHIC2le2LncKp0ShW5VjVpShCeAfo-/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:rabbit', '兔子 · tùzi', null, 'https://drive.google.com/file/d/1bsr-B0VChwBtbAtzUYWw3XxNOm8tdQ0H/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:horse', '马 · mǎ', null, 'https://drive.google.com/file/d/1eOPR9ijCZCZYK2JlKy4QfhdMdqiENzUc/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:farm', '农场 · nóngchǎng', null, 'https://drive.google.com/file/d/12fQ1TLKBpoZ7GWgcJ1VQ4NIbc1W16Tpv/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:wo-shi', '我是… · wǒ shì…', null, 'https://drive.google.com/file/d/1ifEjsJxsrtrlae9UALLC4z59DAFN9XfM/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:zhe-shi', '这是… · zhè shì…', null, 'https://drive.google.com/file/d/1FryGPVixCPSoPI1-NhsFKaCz7_QFjuxj/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:run', '跑 · pǎo', null, 'https://drive.google.com/file/d/1FErrO1KK31rE0m1iCua2WjAyh9TWtodX/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:jump', '跳 · tiào', null, 'https://drive.google.com/file/d/1zEgYecw45dyHxbzR0LterPNIWBZtl4Rr/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:lets', '我们…吧! · wǒmen … ba!', null, 'https://drive.google.com/file/d/1nqGYhDcqVRANWl7-R_jcC9vrZ2t_VLFB/view?usp=drive_link', '{}'::jsonb),
  ('pronunciation_audio', 'pronunciation:zai', '在 · zài', null, 'https://drive.google.com/file/d/15n4D2hLmnlRdcGjG1SlXvHyr1UV6R8qZ/view?usp=drive_link', '{}'::jsonb)
on conflict (slug)
do update set
  kind = excluded.kind,
  title = excluded.title,
  description = excluded.description,
  source_url = excluded.source_url,
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
select
  lesson.methodology_lesson_id,
  'Практика дома: ферма, слова и команды',
  'quiz_single_choice',
  'Сначала сопоставь животных и иероглифы, затем повтори слова с аудио, и после этого пройди короткий квиз.',
  '["Рабочая тетрадь, стр. 3–4", "Карточки животных", "Презентация урока 1"]'::jsonb,
  'Интерактивная практика + квиз из 5 вопросов.',
  10,
  '{"id":"world-around-me-lesson-1-quiz","version":2,"practiceSections":[{"id":"matching-l1","type":"matching","title":"Соедини картинку и иероглиф","prompt":"Перетащи слово к правильной карточке животного.","items":[{"id":"dog","label":"狗","illustrationSrc":"/methodologies/world-around-me/lesson-1/watercolor/dog-card.png"},{"id":"cat","label":"猫","illustrationSrc":"/methodologies/world-around-me/lesson-1/watercolor/cat-card.png"},{"id":"rabbit","label":"兔子","illustrationSrc":"/methodologies/world-around-me/lesson-1/watercolor/rabbit-card.png"},{"id":"horse","label":"马","illustrationSrc":"/methodologies/world-around-me/lesson-1/watercolor/horse-card.png"}]},{"id":"audio-review-l1","type":"audio_review","title":"Слушай и повторяй слова","groups":[{"id":"animals","title":"Животные и ферма","entries":[{"id":"狗","hanzi":"狗","pinyin":"gǒu","meaning":"собака","audioUrl":"https://drive.google.com/file/d/1grQp68jzA-GKI-347k_FCcioEFdpUeIa/view?usp=drive_link"},{"id":"猫","hanzi":"猫","pinyin":"māo","meaning":"кошка","audioUrl":"https://drive.google.com/file/d/1Q-nHIC2le2LncKp0ShW5VjVpShCeAfo-/view?usp=drive_link"}]}]}],"questions":[{"id":"q1","prompt":"Как по-китайски «собака»?","helperText":"Выбери карточку со словом.","options":[{"id":"a","label":"狗"},{"id":"b","label":"猫"},{"id":"c","label":"马"}],"correctOptionId":"a"},{"id":"q2","prompt":"Как по-китайски «кролик»?","options":[{"id":"a","label":"兔子"},{"id":"b","label":"农场"},{"id":"c","label":"狗"}],"correctOptionId":"a"},{"id":"q3","prompt":"Что значит «农场»?","options":[{"id":"a","label":"кошка"},{"id":"b","label":"ферма"},{"id":"c","label":"лошадь"}],"correctOptionId":"b"},{"id":"q4","prompt":"Выбери фразу «Это…»","options":[{"id":"a","label":"我是…"},{"id":"b","label":"这是…"},{"id":"c","label":"我们…吧！"}],"correctOptionId":"b"},{"id":"q5","prompt":"Какое слово значит «прыгать»?","options":[{"id":"a","label":"跑"},{"id":"b","label":"在"},{"id":"c","label":"跳"}],"correctOptionId":"c"}]}'::jsonb
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
select
  lesson.methodology_lesson_id,
  'Урок 1. Животные на ферме',
  'Полноценный урок-хаб: презентация, карточки, счёт, движение, ферма и практика.',
  '{
    "sections": [
      {
        "type": "lesson_focus",
        "title": "Урок 1 · Животные на ферме",
        "subtitle": "Сяо Лон и Сяо Мей приглашают в фермерское приключение.",
        "body": "Поздороваемся, посмотрим презентацию, потренируем слова и команды, поработаем с приложением 1 и закрепим урок песней.",
        "chips": ["狗","猫","兔子","马","农场"],
        "tone": "sky",
        "layout": "hero",
        "sceneId": "scene-hero"
      },
      {
        "type": "presentation",
        "title": "Презентация урока",
        "sceneId": "scene-presentation",
        "assetId": "presentation:world-around-me-lesson-1",
        "readOnly": true
      },
      {
        "type": "vocabulary_cards",
        "title": "Большие карточки слов",
        "sceneId": "scene-flashcards",
        "displayMode": "carousel",
        "items": [
          { "term": "狗", "pinyin": "gǒu", "meaning": "собака", "audioAssetId": "pronunciation:dog" },
          { "term": "猫", "pinyin": "māo", "meaning": "кошка", "audioAssetId": "pronunciation:cat" },
          { "term": "兔子", "pinyin": "tùzi", "meaning": "кролик", "audioAssetId": "pronunciation:rabbit" },
          { "term": "马", "pinyin": "mǎ", "meaning": "лошадь", "audioAssetId": "pronunciation:horse" }
        ]
      },
      {
        "type": "count_board",
        "title": "Приложение 1: считаем и называем",
        "sceneId": "scene-counting",
        "assetId": "worksheet:appendix-1",
        "prompt": "Покажи группу, посчитай животных и назови их вслух.",
        "groups": [
          { "id": "g1", "label": "1 × 狗", "count": 1, "cue": "一只狗" },
          { "id": "g2", "label": "2 × 猫", "count": 2, "cue": "两只猫" }
        ]
      },
      {
        "type": "action_cards",
        "title": "Движение и команды",
        "sceneId": "scene-actions",
        "displayMode": "slider",
        "items": [
          { "term": "跑", "pinyin": "pǎo", "meaning": "бежать", "movementHint": "Побежали вместе по команде.", "commandExample": "我们跑吧！ / 跑到狗！", "audioAssetId": "pronunciation:run" },
          { "term": "跳", "pinyin": "tiào", "meaning": "прыгать", "movementHint": "Прыгаем на месте и к карточке.", "commandExample": "我们跳吧！ / 跳到兔子！", "audioAssetId": "pronunciation:jump" }
        ]
      },
      {
        "type": "word_list",
        "title": "Новые слова и фразы",
        "sceneId": "scene-review",
        "groups": [
          {
            "id": "animals",
            "title": "Животные и ферма",
            "entries": [
              { "hanzi": "狗", "pinyin": "gǒu", "meaning": "собака", "audioAssetId": "pronunciation:dog" },
              { "hanzi": "猫", "pinyin": "māo", "meaning": "кошка", "audioAssetId": "pronunciation:cat" }
            ]
          }
        ]
      }
    ]
  }'::jsonb
from lesson
on conflict (methodology_lesson_id)
do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  content_payload = excluded.content_payload,
  updated_at = now();

commit;
