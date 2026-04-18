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
  'Смотрим, играем, двигаемся и повторяем китайские слова вместе.',
  '{
    "sections": [
      {
        "type": "lesson_focus",
        "title": "Урок 1 · Животные на ферме",
        "subtitle": "Сегодня мы отправляемся на ферму вместе с Сяо Лоном и Сяо Мей.",
        "body": "Сначала поздороваемся, посмотрим видео, выучим слова и поиграем в активные игры с командами.",
        "chips": ["狗", "猫", "兔子", "马", "农场"],
        "tone": "sky",
        "illustrationSrc": "/methodologies/world-around-me/lesson-1/farm-scene.svg"
      },
      {
        "type": "lesson_focus",
        "title": "Сегодня на уроке",
        "body": "Смотрим видео, считаем до 5, двигаемся по командам, работаем в тетради и поём песню farm animals.",
        "chips": ["我是…", "这是…", "我们跑吧！", "我们跳吧！", "在…里"],
        "tone": "violet"
      },
      {
        "type": "vocabulary_cards",
        "title": "Слова-животные",
        "tone": "amber",
        "items": [
          { "term": "狗", "pinyin": "gǒu", "meaning": "собака", "illustrationSrc": "/methodologies/world-around-me/lesson-1/dog.svg" },
          { "term": "猫", "pinyin": "māo", "meaning": "кот / кошка", "illustrationSrc": "/methodologies/world-around-me/lesson-1/cat.svg" },
          { "term": "兔子", "pinyin": "tùzi", "meaning": "кролик", "illustrationSrc": "/methodologies/world-around-me/lesson-1/rabbit.svg" },
          { "term": "马", "pinyin": "mǎ", "meaning": "лошадь", "illustrationSrc": "/methodologies/world-around-me/lesson-1/horse.svg" }
        ]
      },
      {
        "type": "phrase_cards",
        "title": "Фраза урока: 我是…",
        "tone": "violet",
        "items": [{ "phrase": "我是…", "pinyin": "wǒ shì…", "meaning": "Я…", "usageHint": "Представься сам или как герой/животное.", "example": "我是狗。" }]
      },
      {
        "type": "phrase_cards",
        "title": "Фраза урока: 这是…",
        "tone": "violet",
        "items": [{ "phrase": "这是…", "pinyin": "zhè shì…", "meaning": "Это…", "usageHint": "Покажи карточку и скажи, кто это.", "example": "这是猫。" }]
      },
      {
        "type": "action_cards",
        "title": "Движение: 跑 и 跳",
        "tone": "emerald",
        "items": [
          { "term": "跑", "pinyin": "pǎo", "meaning": "бежать", "movementHint": "Бежим к игрушке по команде.", "illustrationSrc": "/methodologies/world-around-me/lesson-1/run.svg" },
          { "term": "跳", "pinyin": "tiào", "meaning": "прыгать", "movementHint": "Прыгаем как животные фермы.", "illustrationSrc": "/methodologies/world-around-me/lesson-1/jump.svg" }
        ]
      },
      {
        "type": "phrase_cards",
        "title": "Команды",
        "tone": "emerald",
        "items": [
          { "phrase": "我们跑吧！", "pinyin": "wǒmen pǎo ba!", "meaning": "Давайте побежим!", "example": "跑到狗！" },
          { "phrase": "我们跳吧！", "pinyin": "wǒmen tiào ba!", "meaning": "Давайте попрыгаем!", "example": "跳到兔子！" }
        ]
      },
      {
        "type": "phrase_cards",
        "title": "Ферма: 农场 и 在…里",
        "tone": "amber",
        "illustrationSrc": "/methodologies/world-around-me/lesson-1/barn.svg",
        "items": [
          { "phrase": "农场", "pinyin": "nóngchǎng", "meaning": "ферма" },
          { "phrase": "在…里", "pinyin": "zài…lǐ", "meaning": "внутри / в", "example": "猫住在农场里。" }
        ]
      },
      {
        "type": "worksheet",
        "title": "Практика в тетради",
        "tone": "amber",
        "illustrationSrc": "/methodologies/world-around-me/lesson-1/workbook.svg",
        "assetId": "worksheet:workbook-pages-3-4",
        "pageLabel": "Рабочая тетрадь · стр. 3–4",
        "instructions": "Раскрась животных и ответь на вопрос «这是什么？»."
      },
      {
        "type": "media_asset",
        "title": "Песня farm animals",
        "tone": "rose",
        "assetId": "song:farm-animals",
        "assetKind": "song",
        "studentPrompt": "Пой и повторяй движения вместе с группой.",
        "teacherShareHint": "Песня открывает и завершает учебный цикл урока."
      },
      {
        "type": "recap",
        "title": "Вспомнить дома",
        "bullets": [
          "Назови 4 животных: 狗, 猫, 兔子, 马.",
          "Скажи про себя и предмет: «我是…», «这是…».",
          "Покажи движения 跑 и 跳 и проговори команды.",
          "Скажи одну фразу с 农场 и 在…里."
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
