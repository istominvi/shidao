begin;

insert into public.methodology_lesson_student_content (
  methodology_lesson_id,
  title,
  subtitle,
  content_payload
)
select
  ml.id,
  'Урок 1. Животные на ферме',
  'Большое фермерское приключение: говорим, считаем, двигаемся и поём.',
  '{
    "sections": [
      {
        "type": "lesson_focus",
        "title": "Урок 1 · Животные на ферме",
        "subtitle": "Сегодня мы отправляемся на ферму вместе с Сяо Лоном и Сяо Мей.",
        "body": "Поздороваемся, посмотрим видео и выучим первые слова про животных.",
        "chips": ["狗", "猫", "兔子", "马"],
        "tone": "sky",
        "layout": "hero",
        "illustrationSrc": "/methodologies/world-around-me/lesson-1/farm-scene.svg",
        "sceneId": "scene-hero"
      },
      {
        "type": "lesson_focus",
        "title": "Что мы делаем сегодня",
        "body": "Смотрим видео farm animals, считаем до 5, двигаемся по командам, работаем в тетради и поём песню.",
        "chips": ["смотреть", "считать", "двигаться", "практиковать", "петь"],
        "tone": "violet",
        "layout": "roadmap",
        "sceneId": "scene-roadmap"
      },
      {
        "type": "vocabulary_cards",
        "title": "Животные фермы",
        "subtitle": "Смотри на карточку, слушай и повторяй слово.",
        "tone": "amber",
        "layout": "vocabulary",
        "sceneId": "scene-vocabulary",
        "items": [
          { "term": "狗", "pinyin": "gǒu", "meaning": "собака", "visualHint": "Скажи громко: gǒu!", "illustrationSrc": "/methodologies/world-around-me/lesson-1/dog.svg" },
          { "term": "猫", "pinyin": "māo", "meaning": "кошка", "visualHint": "Покажи лапки, как у кошки.", "illustrationSrc": "/methodologies/world-around-me/lesson-1/cat.svg" },
          { "term": "兔子", "pinyin": "tùzi", "meaning": "кролик", "visualHint": "Прыгни как кролик.", "illustrationSrc": "/methodologies/world-around-me/lesson-1/rabbit.svg" },
          { "term": "马", "pinyin": "mǎ", "meaning": "лошадь", "visualHint": "Покажи, как скачет лошадка.", "illustrationSrc": "/methodologies/world-around-me/lesson-1/horse.svg" }
        ]
      },
      {
        "type": "phrase_cards",
        "title": "Говорим по-китайски",
        "subtitle": "Скажи о себе и покажи, кто на карточке.",
        "tone": "violet",
        "layout": "phrases",
        "sceneId": "scene-phrases",
        "items": [
          { "phrase": "我是…", "pinyin": "wǒ shì…", "meaning": "Я…", "usageHint": "Назови себя или выбранное животное.", "example": "我是小猫。" },
          { "phrase": "这是…", "pinyin": "zhè shì…", "meaning": "Это…", "usageHint": "Покажи карточку и назови животное.", "example": "这是狗。" }
        ]
      },
      {
        "type": "lesson_focus",
        "title": "Считаем до 5",
        "subtitle": "Берём палочки и считаем вместе.",
        "body": "Покажи животных в Приложении 1 указкой, посчитай и назови их вслух.",
        "chips": ["1", "2", "3", "4", "5"],
        "tone": "sky",
        "layout": "counting",
        "illustrationSrc": "/methodologies/world-around-me/lesson-1/counting.svg",
        "sceneId": "scene-counting"
      },
      {
        "type": "action_cards",
        "title": "Движение и команды",
        "subtitle": "Слушай команду и двигайся быстро.",
        "tone": "emerald",
        "layout": "movement",
        "sceneId": "scene-movement",
        "items": [
          { "term": "跑", "pinyin": "pǎo", "meaning": "бежать", "movementHint": "我们跑吧！ — 跑到狗！", "illustrationSrc": "/methodologies/world-around-me/lesson-1/run.svg" },
          { "term": "跳", "pinyin": "tiào", "meaning": "прыгать", "movementHint": "我们跳吧！ — 跳到兔子！", "illustrationSrc": "/methodologies/world-around-me/lesson-1/jump.svg" }
        ]
      },
      {
        "type": "phrase_cards",
        "title": "Ферма и где живут животные",
        "subtitle": "Ставим игрушки в ферму и говорим полными фразами.",
        "tone": "amber",
        "layout": "farm",
        "illustrationSrc": "/methodologies/world-around-me/lesson-1/barn.svg",
        "sceneId": "scene-farm",
        "items": [
          { "phrase": "农场", "pinyin": "nóngchǎng", "meaning": "ферма", "usageHint": "Покажи карточку фермы." },
          { "phrase": "在…里", "pinyin": "zài…lǐ", "meaning": "внутри / в", "usageHint": "Скажи, где находится животное.", "example": "猫住在农场里。" }
        ]
      },
      {
        "type": "worksheet",
        "title": "Закрепляем: тетрадь",
        "subtitle": "Спокойная практика после активных игр.",
        "tone": "amber",
        "layout": "practice",
        "sceneId": "scene-practice",
        "illustrationSrc": "/methodologies/world-around-me/lesson-1/workbook.svg",
        "assetId": "worksheet:workbook-pages-3-4",
        "pageLabel": "Рабочая тетрадь · стр. 3–4",
        "instructions": "Раскрась животных и ответь: «这是什么？».",
        "teacherHint": "Сначала раскрашиваем, потом показываем и называем вслух."
      },
      {
        "type": "media_asset",
        "title": "Заканчиваем песней farm animals",
        "subtitle": "Поём и повторяем движения животных.",
        "tone": "rose",
        "layout": "practice",
        "sceneId": "scene-practice",
        "assetId": "song:farm-animals",
        "assetKind": "song",
        "studentPrompt": "Пой и двигайся вместе с группой.",
        "teacherShareHint": "Если кнопки нет, песню включает преподаватель в классе.",
        "ctaLabel": "Слушать песню"
      },
      {
        "type": "recap",
        "title": "Вспомнить дома",
        "subtitle": "Короткий повтор перед домашним заданием.",
        "tone": "neutral",
        "layout": "recap",
        "sceneId": "scene-recap",
        "bullets": [
          "Назови 4 животных: 狗, 猫, 兔子, 马.",
          "Скажи: 我是…",
          "Скажи: 这是狗。 / 这是猫。",
          "Покажи 跑 и 跳.",
          "Скажи одну фразу с 农场 или 在…里."
        ]
      }
    ]
  }'::jsonb
from public.methodology_lesson ml
join public.methodology m on m.id = ml.methodology_id
where m.slug = 'world-around-me'
  and ml.module_index = 1
  and ml.lesson_index = 1
on conflict (methodology_lesson_id)
do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  content_payload = excluded.content_payload,
  updated_at = now();

commit;
