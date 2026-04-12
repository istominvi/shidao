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

create index if not exists methodology_lesson_student_content_lesson_idx
  on public.methodology_lesson_student_content (methodology_lesson_id);

alter table public.methodology_lesson_student_content enable row level security;

drop trigger if exists trg_methodology_lesson_student_content_updated_at on public.methodology_lesson_student_content;
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
  'Смотрим, двигаемся и повторяем китайские слова вместе.',
  '{
    "sections": [
      {
        "type": "lesson_focus",
        "title": "Сегодня на уроке",
        "body": "Познакомимся с животными фермы, скажем «Я…» и «Это…», а потом сыграем в подвижные игры.",
        "chips": ["狗", "猫", "兔子", "马", "农场", "我是…", "这是…", "跑", "跳"]
      },
      {
        "type": "vocabulary_cards",
        "title": "Слова",
        "items": [
          { "term": "狗", "pinyin": "gǒu", "meaning": "собака", "visualHint": "карточка собаки" },
          { "term": "猫", "pinyin": "māo", "meaning": "кот / кошка", "visualHint": "карточка кошки" },
          { "term": "兔子", "pinyin": "tùzi", "meaning": "кролик", "visualHint": "карточка кролика" },
          { "term": "马", "pinyin": "mǎ", "meaning": "лошадь", "visualHint": "карточка лошади" },
          { "term": "农场", "pinyin": "nóngchǎng", "meaning": "ферма", "visualHint": "карточка фермы" }
        ]
      },
      {
        "type": "phrase_cards",
        "title": "Фразы",
        "items": [
          { "phrase": "我是…", "pinyin": "wǒ shì…", "meaning": "Я…", "usageHint": "Представься или выбери, кем ты сегодня играешь." },
          { "phrase": "这是…", "pinyin": "zhè shì…", "meaning": "Это…", "usageHint": "Покажи карточку и назови животное." }
        ]
      },
      {
        "type": "media_asset",
        "title": "Видео: farm animals",
        "assetId": "video:farm-animals",
        "assetKind": "video",
        "studentPrompt": "Смотри внимательно и повторяй названия животных.",
        "teacherShareHint": "Покажи видео на большом экране перед активностями."
      },
      {
        "type": "media_asset",
        "title": "Песня: farm animals",
        "assetId": "song:farm-animals",
        "assetKind": "song",
        "studentPrompt": "Пой и повторяй движения вместе с героями.",
        "teacherShareHint": "Используй в финале урока для закрепления."
      },
      {
        "type": "action_cards",
        "title": "Движение",
        "items": [
          { "term": "跑", "pinyin": "pǎo", "meaning": "бежать", "movementHint": "Бежим к нужной игрушке или карточке." },
          { "term": "跳", "pinyin": "tiào", "meaning": "прыгать", "movementHint": "Прыгаем как животные фермы." }
        ]
      },
      {
        "type": "worksheet",
        "title": "Рабочая тетрадь",
        "assetId": "worksheet:workbook-pages-3-4",
        "pageLabel": "Страницы 3–4",
        "instructions": "Раскрась животных и ответь на вопрос «这是什么？»."
      },
      {
        "type": "worksheet",
        "title": "Приложение",
        "assetId": "worksheet:appendix-1",
        "pageLabel": "Приложение 1",
        "instructions": "Покажи указкой животных, посчитай и назови их вслух."
      },
      {
        "type": "recap",
        "title": "Вспомнить дома",
        "bullets": [
          "Назови дома 4 животных фермы по-китайски.",
          "Скажи 2 фразы с «我是…» или «这是…».",
          "Покажи движение «跑» и «跳» и повтори слова."
        ]
      }
    ]
  }'::jsonb
from public.methodology_lesson ml
join public.methodology m on m.id = ml.methodology_id
where m.slug = 'world-around-me'
  and ml.title = 'Урок 1. Животные на ферме'
  and not exists (
    select 1
    from public.methodology_lesson_student_content sc
    where sc.methodology_lesson_id = ml.id
  );

commit;
