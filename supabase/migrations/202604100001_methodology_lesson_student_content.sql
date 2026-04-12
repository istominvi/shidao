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
  'Учимся замечать животных, говорить простые фразы и двигаться вместе.',
  '{
    "sections": [
      {
        "type": "lesson_focus",
        "title": "Сегодня на уроке",
        "body": "Познакомимся с животными на ферме, посмотрим видео и песню, а потом поиграем в движения.",
        "chips": ["狗", "猫", "兔子", "马", "农场", "我是…", "这是…", "跑", "跳"]
      },
      {
        "type": "vocabulary_cards",
        "title": "Слова",
        "items": [
          {"term": "狗", "pinyin": "gǒu", "meaning": "собака"},
          {"term": "猫", "pinyin": "māo", "meaning": "кошка"},
          {"term": "兔子", "pinyin": "tùzi", "meaning": "кролик"},
          {"term": "马", "pinyin": "mǎ", "meaning": "лошадь"},
          {"term": "农场", "pinyin": "nóngchǎng", "meaning": "ферма"}
        ]
      },
      {
        "type": "phrase_cards",
        "title": "Фразы",
        "items": [
          {"phrase": "我是…", "pinyin": "wǒ shì…", "meaning": "Я…"},
          {"phrase": "这是…", "pinyin": "zhè shì…", "meaning": "Это…"}
        ]
      },
      {"type": "media_asset", "title": "Смотри и слушай: видео", "assetId": "video:farm-animals", "assetKind": "video", "studentPrompt": "Посмотри видео farm animals и назови знакомых животных."},
      {"type": "media_asset", "title": "Смотри и слушай: песня", "assetId": "song:farm-animals", "assetKind": "song", "studentPrompt": "Спой вместе песню farm animals и покажи движения животных."},
      {"type": "action_cards", "title": "Движение", "items": [{"term": "跑", "pinyin": "pǎo", "meaning": "бежать", "movementHint": "Бежим к нужной карточке"}, {"term": "跳", "pinyin": "tiào", "meaning": "прыгать", "movementHint": "Прыгаем как кролики"}]},
      {"type": "worksheet", "title": "Рабочая тетрадь", "assetId": "worksheet:workbook-pages-3-4", "instructions": "Открой страницы 3–4, раскрась животных и ответь на вопрос «这是什么？».", "pageLabel": "Страницы 3–4"},
      {"type": "worksheet", "title": "Приложение 1", "assetId": "worksheet:appendix-1", "instructions": "Покажи животных указкой, посчитай и назови их вслух.", "pageLabel": "Appendix 1"},
      {"type": "recap", "title": "Вспомнить дома", "bullets": ["Назови дома 4 животных: 狗, 猫, 兔子, 马.", "Скажи две фразы: 我是… и 这是…", "Покажи движения 跑 и 跳 вместе с родителями."]}
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
