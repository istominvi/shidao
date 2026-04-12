begin;

create table if not exists public.methodology_lesson_student_content (
  id uuid primary key default gen_random_uuid(),
  methodology_lesson_id uuid not null unique references public.methodology_lesson(id) on delete cascade,
  title text not null,
  subtitle text null,
  content_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_methodology_lesson_student_content_lesson_id
  on public.methodology_lesson_student_content(methodology_lesson_id);

alter table public.methodology_lesson_student_content enable row level security;

drop trigger if exists trg_methodology_lesson_student_content_updated_at
  on public.methodology_lesson_student_content;
create trigger trg_methodology_lesson_student_content_updated_at
before update on public.methodology_lesson_student_content
for each row execute function public.set_updated_at();

insert into public.methodology_lesson_student_content (
  methodology_lesson_id,
  title,
  subtitle,
  content_payload
)
select
  ml.id,
  'Урок 1. Животные на ферме',
  'Смотрим, двигаемся и говорим по-китайски',
  '{
    "sections": [
      {
        "type": "lesson_focus",
        "title": "Сегодня на уроке",
        "body": "Познакомимся с животными фермы, повторим движения и вместе споём песню.",
        "chips": ["狗", "猫", "兔子", "马", "农场", "我是…", "这是…", "跑", "跳"]
      },
      {
        "type": "vocabulary_cards",
        "title": "Слова",
        "items": [
          { "term": "狗", "pinyin": "gǒu", "meaning": "собака" },
          { "term": "猫", "pinyin": "māo", "meaning": "кот / кошка" },
          { "term": "兔子", "pinyin": "tùzi", "meaning": "кролик" },
          { "term": "马", "pinyin": "mǎ", "meaning": "лошадь" },
          { "term": "农场", "pinyin": "nóngchǎng", "meaning": "ферма" }
        ]
      },
      {
        "type": "phrase_cards",
        "title": "Фразы",
        "items": [
          { "phrase": "我是…", "pinyin": "wǒ shì…", "meaning": "Я…" },
          { "phrase": "这是…", "pinyin": "zhè shì…", "meaning": "Это…" }
        ]
      },
      {
        "type": "media_asset",
        "title": "Смотри и слушай: видео",
        "assetId": "video:farm-animals",
        "assetKind": "video",
        "studentPrompt": "Посмотри видео и найди животных фермы."
      },
      {
        "type": "media_asset",
        "title": "Смотри и слушай: песня",
        "assetId": "song:farm-animals",
        "assetKind": "song",
        "studentPrompt": "Спой песню и покажи движения животных."
      },
      {
        "type": "action_cards",
        "title": "Движение",
        "items": [
          { "term": "跑", "pinyin": "pǎo", "meaning": "бежать", "movementHint": "беги к карточке" },
          { "term": "跳", "pinyin": "tiào", "meaning": "прыгать", "movementHint": "прыгай как кролик" }
        ]
      },
      {
        "type": "worksheet",
        "title": "Рабочая тетрадь",
        "assetId": "worksheet:workbook-pages-3-4",
        "instructions": "Раскрась животных и ответь на вопрос «这是什么?»",
        "pageLabel": "Стр. 3–4"
      },
      {
        "type": "worksheet",
        "title": "Приложение",
        "assetId": "worksheet:appendix-1",
        "instructions": "Покажи указкой животное, посчитай и назови его.",
        "pageLabel": "Приложение 1"
      },
      {
        "type": "recap",
        "title": "Вспомнить дома",
        "bullets": [
          "Назови дома 2 животных: 狗 и 猫.",
          "Повтори фразы «我是…» и «这是…».",
          "Покажи действия 跑 и 跳 вместе с родителем."
        ]
      }
    ]
  }'::jsonb
from public.methodology_lesson ml
join public.methodology m on m.id = ml.methodology_id
where m.slug = 'world-around-me'
  and ml.title = 'Урок 1. Животные на ферме'
on conflict (methodology_lesson_id) do update
set
  title = excluded.title,
  subtitle = excluded.subtitle,
  content_payload = excluded.content_payload,
  updated_at = now();

commit;
