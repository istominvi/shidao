\set ON_ERROR_STOP on

-- Run explicitly against the current ShiDao database:
-- psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
--   -v publisher_account_id='<publisher Account UUID>' \
--   -v attested_account_id='<attested Account UUID>' \
--   -f scripts/bootstrap-chinese-educator-attestation.sql

\if :{?publisher_account_id}
\else
  \echo 'Required psql variable is missing: publisher_account_id'
  \quit 3
\endif

\if :{?attested_account_id}
\else
  \echo 'Required psql variable is missing: attested_account_id'
  \quit 3
\endif

begin;

select set_config(
  'shidao.bootstrap.publisher_account_id',
  :'publisher_account_id',
  true
);
select set_config(
  'shidao.bootstrap.attested_account_id',
  :'attested_account_id',
  true
);

-- This read-only preflight must finish before any persistent fixture write.
do $bootstrap_preflight$
declare
  v_publisher_account_id uuid;
  v_attested_account_id uuid;
  v_publisher_auth_user_id uuid;
  v_attested_auth_user_id uuid;
begin
  begin
    v_publisher_account_id := current_setting(
      'shidao.bootstrap.publisher_account_id'
    )::uuid;
    v_attested_account_id := current_setting(
      'shidao.bootstrap.attested_account_id'
    )::uuid;
  exception
    when invalid_text_representation then
      raise exception 'bootstrap_account_id_invalid'
        using errcode = '22023';
  end;

  if v_publisher_account_id is null or v_attested_account_id is null then
    raise exception 'bootstrap_account_id_invalid'
      using errcode = '22023';
  end if;

  if to_regnamespace('auth') is null
    or to_regclass('auth.users') is null
    or to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_component') is null
    or to_regclass('public.lesson_student_slide') is null
    or to_regclass('public.course_publication') is null
    or to_regclass('public.course_publication_revision') is null
    or to_regclass('public.course_attestation') is null
    or to_regclass('public.course_publication_attestation') is null
    or to_regclass('public.course_attestation_attempt') is null
    or to_regclass('public.course_attestation_award') is null
    or to_regclass('public.lesson_step') is not null
    or to_regprocedure('auth.uid()') is null
    or to_regprocedure('extensions.digest(text,text)') is null
    or to_regprocedure(
      'public.publish_course_revision_with_attestation_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean,text,jsonb)'
    ) is null
    or to_regprocedure(
      'public.submit_my_course_publication_attestation(uuid,uuid,jsonb)'
    ) is null
    or to_regrole('authenticated') is null
  then
    raise exception 'shidao_schema_sanity_check_failed'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_attribute as attribute
    where attribute.attrelid = 'public.course'::regclass
      and attribute.attname = 'learning_audience'
      and attribute.atttypid = 'text'::regtype
      and attribute.attnotnull
      and attribute.attnum > 0
      and not attribute.attisdropped
  )
    or not exists (
      select 1
      from pg_attribute as attribute
      where attribute.attrelid = 'public.course_publication'::regclass
        and attribute.attname = 'learning_audience'
        and attribute.atttypid = 'text'::regtype
        and attribute.attnotnull
        and attribute.attnum > 0
        and not attribute.attisdropped
    )
  then
    raise exception 'shidao_learning_audience_schema_invalid'
      using errcode = '55000';
  end if;

  if not pg_has_role(session_user, 'authenticated', 'USAGE')
    or not has_database_privilege(current_user, current_database(), 'TEMP')
    or not has_table_privilege(current_user, 'public.course', 'SELECT')
    or not has_table_privilege(current_user, 'public.course', 'INSERT')
    or not has_table_privilege(current_user, 'public.course', 'UPDATE')
    or not has_table_privilege(current_user, 'public.lesson', 'SELECT')
    or not has_table_privilege(current_user, 'public.lesson', 'INSERT')
    or not has_table_privilege(current_user, 'public.lesson', 'UPDATE')
    or not has_table_privilege(
      current_user,
      'public.lesson_student_slide',
      'SELECT'
    )
    or not has_table_privilege(
      current_user,
      'public.lesson_student_slide',
      'INSERT'
    )
    or not has_table_privilege(
      current_user,
      'public.lesson_component',
      'SELECT'
    )
    or not has_table_privilege(
      current_user,
      'public.lesson_component',
      'INSERT'
    )
    or not has_table_privilege(
      current_user,
      'public.lesson_component',
      'UPDATE'
    )
    or not has_table_privilege(
      current_user,
      'public.course_attestation',
      'SELECT'
    )
    or not has_table_privilege(
      current_user,
      'public.course_attestation',
      'INSERT'
    )
    or not has_table_privilege(
      current_user,
      'public.course_attestation',
      'UPDATE'
    )
    or not has_function_privilege(
      current_user,
      'public.publish_course_revision_with_attestation_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean,text,jsonb)',
      'EXECUTE'
    )
    or pg_get_userbyid(
      (
        select relation.relowner
        from pg_class as relation
        where relation.oid = 'public.course'::regclass
      )
    ) <> current_user
  then
    raise exception 'bootstrap_database_role_not_authorized'
      using errcode = '42501';
  end if;

  select account.auth_user_id
  into v_publisher_auth_user_id
  from public.account as account
  join auth.users as auth_user on auth_user.id = account.auth_user_id
  where account.id = v_publisher_account_id
    and account.status = 'active';

  if not found or v_publisher_auth_user_id is null then
    raise exception 'bootstrap_publisher_account_not_active'
      using errcode = '42501';
  end if;

  select account.auth_user_id
  into v_attested_auth_user_id
  from public.account as account
  join auth.users as auth_user on auth_user.id = account.auth_user_id
  where account.id = v_attested_account_id
    and account.status = 'active';

  if not found or v_attested_auth_user_id is null then
    raise exception 'bootstrap_attested_account_not_active'
      using errcode = '42501';
  end if;
end
$bootstrap_preflight$;

select pg_advisory_xact_lock(
  hashtextextended('shidao.bootstrap.chinese-educator-attestation.v1', 0)
);

create temporary table shidao_chinese_educator_lessons (
  position integer primary key,
  title text not null,
  summary text not null,
  content text not null
) on commit drop;

insert into pg_temp.shidao_chinese_educator_lessons (
  position,
  title,
  summary,
  content
)
values
  (
    1,
    'Диагностика и цели обучения',
    'Как определить стартовый уровень и превратить запрос группы в наблюдаемые результаты.',
    $lesson_1$## Результат урока

Преподаватель составляет короткую входную диагностику по четырём каналам: восприятие речи, говорение, чтение и письмо. Затем формулирует 2–3 наблюдаемых результата курса и объясняет их обучающимся.

**Практика:** разберите три профиля начинающих и выберите для каждого одну ближайшую коммуникативную цель.$lesson_1$
  ),
  (
    2,
    'Тоны и фонетическая коррекция',
    'Контекст, жест, визуальная опора и запись вместо изолированной механической отработки.',
    $lesson_2$## Результат урока

Преподаватель вводит тоны через понятный контекст, слуховую модель и движение высоты голоса, а затем переносит их в короткие реплики. Коррекция остаётся точечной: сначала ошибка, влияющая на понимание, затем один способ самопроверки.

**Практика:** спроектируйте пятиминутный цикл «услышать → различить → произнести → применить».$lesson_2$
  ),
  (
    3,
    'Иероглифы: от компонентов к смыслу',
    'Осмысленное распознавание ключей и фонетиков с активным извлечением из памяти.',
    $lesson_3$## Результат урока

Преподаватель показывает структуру иероглифа, связывает графические компоненты со значением или чтением и чередует узнавание с воспроизведением. Многократное списывание заменяется короткими распределёнными подходами.

**Практика:** соберите набор из восьми иероглифов вокруг одного смыслового компонента.$lesson_3$
  ),
  (
    4,
    'Лексика и интервальное повторение',
    'Как учить устойчивые речевые блоки и возвращать их в новых ситуациях.',
    $lesson_4$## Результат урока

Новая лексика вводится не отдельными переводами, а полезными сочетаниями и репликами. Повторение требует извлечения ответа и меняет контекст, чтобы знание стало переносимым.

**Практика:** превратите список из десяти слов в пять коммуникативных блоков и три задания на отсроченное извлечение.$lesson_4$
  ),
  (
    5,
    'Коммуникативная задача и обратная связь',
    'Информационный дефицит, понятный результат разговора и приоритетная коррекция.',
    $lesson_5$## Результат урока

Преподаватель проектирует задание, где партнёры обладают разной информацией и должны договориться о результате. Во время разговора фиксируются повторяющиеся ошибки, а после него группа получает короткую обратную связь и повторяет ключевую реплику точнее.

**Практика:** создайте ролевую задачу «выбрать маршрут» с двумя разными карточками информации.$lesson_5$
  ),
  (
    6,
    'Проектирование итогового занятия',
    'Согласование целей, практики и критериального оценивания в одном сценарии.',
    $lesson_6$## Результат урока

Итоговое занятие проверяет то действие, которое было заявлено целью курса. Критерии заранее описывают понятность, уместность лексики, фонетическую точность и самостоятельность, не превращая оценивание в подсчёт разрозненных ошибок.

**Практика:** соберите 45-минутный сценарий и рубрику из четырёх наблюдаемых критериев.$lesson_6$
  );

create temporary table shidao_chinese_educator_fixture (
  course_id uuid primary key,
  publication_id uuid not null unique,
  revision_id uuid,
  questions jsonb not null,
  attestation jsonb,
  answers jsonb not null,
  snapshot jsonb,
  content_sha256 text
) on commit drop;

insert into pg_temp.shidao_chinese_educator_fixture (
  course_id,
  publication_id,
  questions,
  answers
)
values (
  md5('shidao.bootstrap.chinese-educator.course.v1')::uuid,
  md5('shidao.bootstrap.chinese-educator.publication.v1')::uuid,
  $questions$[
    {
      "id": "q1",
      "prompt": "С чего лучше начать планирование курса для новой группы?",
      "options": [
        { "id": "q1_a", "label": "С короткой диагностической задачи и наблюдаемых целей" },
        { "id": "q1_b", "label": "С выбора самого объёмного учебника" },
        { "id": "q1_c", "label": "С заучивания полного списка правил" }
      ],
      "correctOptionId": "q1_a",
      "explanation": "Диагностика связывает реальные стартовые возможности группы с проверяемыми результатами обучения."
    },
    {
      "id": "q2",
      "prompt": "Какой цикл помогает перенести китайские тоны в речь?",
      "options": [
        { "id": "q2_a", "label": "Услышать, различить, произнести и применить в реплике" },
        { "id": "q2_b", "label": "Переписать обозначение тона двадцать раз" },
        { "id": "q2_c", "label": "Сразу читать длинный незнакомый текст" }
      ],
      "correctOptionId": "q2_a",
      "explanation": "Последовательность ведёт от слуховой модели к самостоятельному коммуникативному использованию."
    },
    {
      "id": "q3",
      "prompt": "Как корректно работать с третьим тоном на начальном уровне?",
      "options": [
        { "id": "q3_a", "label": "Показывать его изменение в связной речи и тренировать в коротких сочетаниях" },
        { "id": "q3_b", "label": "Требовать полный изолированный контур в любой позиции" },
        { "id": "q3_c", "label": "Не давать слуховых образцов до изучения всех правил" }
      ],
      "correctOptionId": "q3_a",
      "explanation": "Контекстная отработка учитывает реальные тоновые изменения и не закрепляет искусственное произношение."
    },
    {
      "id": "q4",
      "prompt": "Как использовать пиньинь, чтобы он не заменил чтение иероглифов?",
      "options": [
        { "id": "q4_a", "label": "Давать его как временную опору и постепенно убирать по мере освоения материала" },
        { "id": "q4_b", "label": "Всегда печатать пиньинь крупнее иероглифов" },
        { "id": "q4_c", "label": "Полностью запретить пиньинь с первого занятия" }
      ],
      "correctOptionId": "q4_a",
      "explanation": "Постепенное снятие опоры сохраняет доступность задания и развивает самостоятельное чтение."
    },
    {
      "id": "q5",
      "prompt": "Какой подход делает изучение иероглифов осмысленным?",
      "options": [
        { "id": "q5_a", "label": "Разбор смысловых и фонетических компонентов плюс извлечение из памяти" },
        { "id": "q5_b", "label": "Только многократное списывание без разбора" },
        { "id": "q5_c", "label": "Запоминание русского перевода без формы и чтения" }
      ],
      "correctOptionId": "q5_a",
      "explanation": "Структурные связи уменьшают случайную нагрузку на память, а извлечение закрепляет доступ к форме."
    },
    {
      "id": "q6",
      "prompt": "Как лучше вводить новую лексику для будущего говорения?",
      "options": [
        { "id": "q6_a", "label": "В устойчивых сочетаниях и репликах с повторным извлечением в новых ситуациях" },
        { "id": "q6_b", "label": "Алфавитным списком изолированных переводов" },
        { "id": "q6_c", "label": "Только через пассивное перечитывание словаря" }
      ],
      "correctOptionId": "q6_a",
      "explanation": "Речевые блоки быстрее становятся инструментом действия, а смена контекста поддерживает перенос."
    },
    {
      "id": "q7",
      "prompt": "Как расставить приоритеты в обратной связи после устного задания?",
      "options": [
        { "id": "q7_a", "label": "Сначала разобрать ошибки, мешающие смыслу или цели задания, и дать способ самокоррекции" },
        { "id": "q7_b", "label": "Прерывать каждую реплику ради исправления всех неточностей" },
        { "id": "q7_c", "label": "Не возвращаться ни к одной ошибке" }
      ],
      "correctOptionId": "q7_a",
      "explanation": "Приоритетная отсроченная коррекция сохраняет коммуникацию и делает обратную связь выполнимой."
    },
    {
      "id": "q8",
      "prompt": "Какое задание наиболее полно создаёт коммуникативную необходимость говорить?",
      "options": [
        { "id": "q8_a", "label": "Информационный дефицит: партнёры обмениваются разными данными и выбирают общий маршрут" },
        { "id": "q8_b", "label": "Хоровое повторение готовых фраз без выбора и результата" },
        { "id": "q8_c", "label": "Переписывание диалога с доски без взаимодействия" }
      ],
      "correctOptionId": "q8_a",
      "explanation": "Разные данные и общий результат дают участникам настоящую причину слушать и формулировать реплики."
    },
    {
      "id": "q9",
      "prompt": "Как дифференцировать одно задание для группы с разным темпом?",
      "options": [
        { "id": "q9_a", "label": "Сохранить общую цель, но дать разные опоры и уровень самостоятельности" },
        { "id": "q9_b", "label": "Дать сильным ученикам другую тему, не связанную с уроком" },
        { "id": "q9_c", "label": "Оставить слабых учеников только наблюдателями" }
      ],
      "correctOptionId": "q9_a",
      "explanation": "Общая цель удерживает группу вместе, а дозированные опоры обеспечивают доступный вызов."
    },
    {
      "id": "q10",
      "prompt": "Что должно определять итоговое оценивание коммуникативного курса?",
      "options": [
        { "id": "q10_a", "label": "Наблюдаемое действие из цели курса и заранее понятные критерии качества" },
        { "id": "q10_b", "label": "Количество страниц, прочитанных преподавателем" },
        { "id": "q10_c", "label": "Только число выученных терминов о языке" }
      ],
      "correctOptionId": "q10_a",
      "explanation": "Согласование цели, практики и критериев делает итоговую проверку валидной и понятной."
    }
  ]$questions$::jsonb,
  $answers${
    "q1": "q1_a",
    "q2": "q2_a",
    "q3": "q3_a",
    "q4": "q4_a",
    "q5": "q5_a",
    "q6": "q6_a",
    "q7": "q7_a",
    "q8": "q8_b",
    "q9": "q9_a",
    "q10": "q10_a"
  }$answers$::jsonb
);

-- Deterministic IDs are reserved for this fixture. Never re-parent or delete
-- a colliding row: fail closed and leave the transaction untouched.
do $fixture_preflight$
declare
  v_course_id uuid;
  v_publication_id uuid;
  v_publisher_account_id uuid := current_setting(
    'shidao.bootstrap.publisher_account_id'
  )::uuid;
begin
  select fixture.course_id, fixture.publication_id
  into strict v_course_id, v_publication_id
  from pg_temp.shidao_chinese_educator_fixture as fixture;

  if exists (
    select 1
    from public.course as course
    where course.id = v_course_id
      and (
        course.owner_account_id <> v_publisher_account_id
        or course.archived_at is not null
      )
  ) then
    raise exception 'bootstrap_fixture_course_conflict'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from pg_temp.shidao_chinese_educator_lessons as fixture_lesson
    join public.lesson as lesson
      on lesson.id = md5(
        'shidao.bootstrap.chinese-educator.lesson.'
        || fixture_lesson.position::text
      )::uuid
    where lesson.course_id <> v_course_id
      or lesson.position <> fixture_lesson.position
  )
    or exists (
      select 1
      from public.lesson as lesson
      where lesson.course_id = v_course_id
        and not exists (
          select 1
          from pg_temp.shidao_chinese_educator_lessons as fixture_lesson
          where lesson.id = md5(
              'shidao.bootstrap.chinese-educator.lesson.'
              || fixture_lesson.position::text
            )::uuid
            and lesson.position = fixture_lesson.position
        )
    )
  then
    raise exception 'bootstrap_fixture_lesson_graph_conflict'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from pg_temp.shidao_chinese_educator_lessons as fixture_lesson
    join public.lesson_student_slide as slide
      on slide.id = md5(
        'shidao.bootstrap.chinese-educator.slide.'
        || fixture_lesson.position::text
      )::uuid
    where slide.lesson_id <> md5(
        'shidao.bootstrap.chinese-educator.lesson.'
        || fixture_lesson.position::text
      )::uuid
      or slide.position <> 1
  )
    or exists (
      select 1
      from public.lesson_student_slide as slide
      join public.lesson as lesson on lesson.id = slide.lesson_id
      where lesson.course_id = v_course_id
        and slide.id <> md5(
          'shidao.bootstrap.chinese-educator.slide.'
          || lesson.position::text
        )::uuid
    )
  then
    raise exception 'bootstrap_fixture_slide_graph_conflict'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from pg_temp.shidao_chinese_educator_lessons as fixture_lesson
    join public.lesson_component as component
      on component.id = md5(
        'shidao.bootstrap.chinese-educator.component.'
        || fixture_lesson.position::text
      )::uuid
    where component.lesson_id <> md5(
        'shidao.bootstrap.chinese-educator.lesson.'
        || fixture_lesson.position::text
      )::uuid
      or component.position <> 1
  )
    or exists (
      select 1
      from public.lesson_component as component
      join public.lesson as lesson on lesson.id = component.lesson_id
      where lesson.course_id = v_course_id
        and component.id <> md5(
          'shidao.bootstrap.chinese-educator.component.'
          || lesson.position::text
        )::uuid
    )
    or exists (
      select 1
      from public.course_attachment as attachment
      where attachment.course_id = v_course_id
    )
  then
    raise exception 'bootstrap_fixture_component_graph_conflict'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.course_publication as publication
    where publication.id = v_publication_id
      and (
        publication.owner_account_id <> v_publisher_account_id
        or publication.source_course_id is distinct from v_course_id
      )
  )
    or exists (
      select 1
      from public.course_publication as publication
      where publication.source_course_id = v_course_id
        and publication.id <> v_publication_id
    )
  then
    raise exception 'bootstrap_fixture_publication_conflict'
      using errcode = '23505';
  end if;
end
$fixture_preflight$;

insert into public.course as target_course (
  id,
  owner_account_id,
  title,
  subject,
  goal,
  level,
  audience_description,
  target_lesson_count,
  teacher_preferences,
  audience_type,
  settings,
  assembled_at,
  learning_audience
)
select
  fixture.course_id,
  current_setting('shidao.bootstrap.publisher_account_id')::uuid,
  'Современный урок китайского языка для детей: произношение, иероглифика и формирующее оценивание',
  'Методика преподавания китайского языка',
  'Спроектировать урок от измеримой цели до обратной связи, диагностировать произношение и тоны, вводить иероглифы через форму, звук и значение.',
  'Профессиональное развитие педагогов',
  'Учителя китайского языка, репетиторы и педагоги дополнительного образования, работающие с детьми 6–14 лет.',
  6,
  'Сохранять связь каждой методической рекомендации с практическим заданием преподавателя.',
  'none',
  '{}'::jsonb,
  clock_timestamp(),
  'educators'
from pg_temp.shidao_chinese_educator_fixture as fixture
on conflict (id) do update
set title = excluded.title,
    subject = excluded.subject,
    goal = excluded.goal,
    level = excluded.level,
    audience_description = excluded.audience_description,
    target_lesson_count = excluded.target_lesson_count,
    teacher_preferences = excluded.teacher_preferences,
    assembled_at = coalesce(target_course.assembled_at, excluded.assembled_at),
    learning_audience = excluded.learning_audience,
    updated_at = clock_timestamp()
where (
  target_course.title,
  target_course.subject,
  target_course.goal,
  target_course.level,
  target_course.audience_description,
  target_course.target_lesson_count,
  target_course.teacher_preferences,
  target_course.assembled_at is null,
  target_course.learning_audience
) is distinct from (
  excluded.title,
  excluded.subject,
  excluded.goal,
  excluded.level,
  excluded.audience_description,
  excluded.target_lesson_count,
  excluded.teacher_preferences,
  false,
  excluded.learning_audience
);

insert into public.lesson as target_lesson (
  id,
  course_id,
  position,
  title,
  summary,
  estimated_duration_minutes,
  settings
)
select
  md5(
    'shidao.bootstrap.chinese-educator.lesson.' || lesson.position::text
  )::uuid,
  fixture.course_id,
  lesson.position,
  lesson.title,
  lesson.summary,
  45,
  '{}'::jsonb
from pg_temp.shidao_chinese_educator_lessons as lesson
cross join pg_temp.shidao_chinese_educator_fixture as fixture
on conflict (id) do update
set position = excluded.position,
    title = excluded.title,
    summary = excluded.summary,
    estimated_duration_minutes = excluded.estimated_duration_minutes,
    updated_at = clock_timestamp()
where (
  target_lesson.position,
  target_lesson.title,
  target_lesson.summary,
  target_lesson.estimated_duration_minutes
) is distinct from (
  excluded.position,
  excluded.title,
  excluded.summary,
  excluded.estimated_duration_minutes
);

insert into public.lesson_student_slide (
  id,
  lesson_id,
  position
)
select
  md5(
    'shidao.bootstrap.chinese-educator.slide.' || lesson.position::text
  )::uuid,
  md5(
    'shidao.bootstrap.chinese-educator.lesson.' || lesson.position::text
  )::uuid,
  1
from pg_temp.shidao_chinese_educator_lessons as lesson
on conflict (id) do nothing;

insert into public.lesson_component as target_component (
  id,
  lesson_id,
  position,
  type_key,
  schema_version,
  payload,
  placement_config,
  visibility,
  student_slide_id
)
select
  md5(
    'shidao.bootstrap.chinese-educator.component.' || lesson.position::text
  )::uuid,
  md5(
    'shidao.bootstrap.chinese-educator.lesson.' || lesson.position::text
  )::uuid,
  1,
  'rich_text',
  1,
  jsonb_build_object('content', lesson.content, 'format', 'markdown'),
  jsonb_build_object('width', 'content', 'textAlign', 'start'),
  'learner_visible',
  md5(
    'shidao.bootstrap.chinese-educator.slide.' || lesson.position::text
  )::uuid
from pg_temp.shidao_chinese_educator_lessons as lesson
on conflict (id) do update
set type_key = excluded.type_key,
    schema_version = excluded.schema_version,
    payload = excluded.payload,
    placement_config = excluded.placement_config,
    visibility = excluded.visibility,
    student_slide_id = excluded.student_slide_id,
    updated_at = clock_timestamp()
where (
  target_component.type_key,
  target_component.schema_version,
  target_component.payload,
  target_component.placement_config,
  target_component.visibility,
  target_component.student_slide_id
) is distinct from (
  excluded.type_key,
  excluded.schema_version,
  excluded.payload,
  excluded.placement_config,
  excluded.visibility,
  excluded.student_slide_id
);

insert into public.course_attestation as target_attestation (
  course_id,
  version,
  title,
  description,
  passing_score_percent,
  questions
)
select
  fixture.course_id,
  1,
  'Итоговая аттестация преподавателя китайского языка',
  'Десять ситуационных вопросов по диагностике, фонетике, иероглифике, лексике, говорению и оцениванию.',
  80,
  fixture.questions
from pg_temp.shidao_chinese_educator_fixture as fixture
on conflict (course_id) do update
set version = target_attestation.version + 1,
    title = excluded.title,
    description = excluded.description,
    passing_score_percent = excluded.passing_score_percent,
    questions = excluded.questions,
    updated_at = clock_timestamp()
where (
  target_attestation.title,
  target_attestation.description,
  target_attestation.passing_score_percent,
  target_attestation.questions
) is distinct from (
  excluded.title,
  excluded.description,
  excluded.passing_score_percent,
  excluded.questions
);

update pg_temp.shidao_chinese_educator_fixture as fixture
set attestation = jsonb_build_object(
  'version', attestation.version,
  'title', attestation.title,
  'description', attestation.description,
  'passingScorePercent', attestation.passing_score_percent,
  'questions', attestation.questions
)
from public.course_attestation as attestation
where attestation.course_id = fixture.course_id;

update pg_temp.shidao_chinese_educator_fixture as fixture
set snapshot = jsonb_build_object(
  'schemaVersion', 1,
  'course', jsonb_build_object(
    'title', course.title,
    'subject', course.subject,
    'goal', course.goal,
    'level', course.level,
    'audienceDescription', course.audience_description,
    'targetLessonCount', course.target_lesson_count
  ),
  'lessons', (
    select jsonb_agg(
      jsonb_build_object(
        'ref', md5(
          'shidao.bootstrap.chinese-educator.publication.lesson-ref.'
          || lesson.position::text
        )::uuid,
        'position', lesson.position,
        'title', lesson.title,
        'summary', lesson.summary,
        'estimatedDurationMinutes', lesson.estimated_duration_minutes,
        'components', (
          select jsonb_agg(
            jsonb_build_object(
              'ref', md5(
                'shidao.bootstrap.chinese-educator.publication.component-ref.'
                || lesson.position::text
                || '.'
                || component.position::text
              )::uuid,
              'position', component.position,
              'typeKey', component.type_key,
              'schemaVersion', component.schema_version,
              'payload', component.payload,
              'placement', component.placement_config,
              'visibility', component.visibility,
              'studentSlideRef', case
                when component.student_slide_id is null then null
                else md5(
                  'shidao.bootstrap.chinese-educator.publication.slide-ref.'
                  || lesson.position::text
                )::uuid
              end
            )
            order by component.position
          )
          from public.lesson_component as component
          where component.lesson_id = lesson.id
        ),
        'slides', (
          select jsonb_agg(
            jsonb_build_object(
              'ref', md5(
                'shidao.bootstrap.chinese-educator.publication.slide-ref.'
                || lesson.position::text
              )::uuid,
              'position', slide.position
            )
            order by slide.position
          )
          from public.lesson_student_slide as slide
          where slide.lesson_id = lesson.id
        )
      )
      order by lesson.position
    )
    from public.lesson as lesson
    where lesson.course_id = fixture.course_id
  ),
  'materials', '[]'::jsonb
)
from public.course as course
where course.id = fixture.course_id;

update pg_temp.shidao_chinese_educator_fixture as fixture
set revision_id = md5(
      'shidao.bootstrap.chinese-educator.revision.assessment-v'
      || (fixture.attestation ->> 'version')
    )::uuid,
    content_sha256 = encode(
      extensions.digest(
        jsonb_build_object(
          'snapshot', fixture.snapshot,
          'learningAudience', 'educators',
          'attestation', fixture.attestation
        )::text,
        'sha256'
      ),
      'hex'
    );

select public.publish_course_revision_with_attestation_admin(
  p_actor_account_id => current_setting(
    'shidao.bootstrap.publisher_account_id'
  )::uuid,
  p_source_course_id => fixture.course_id,
  p_publication_id => fixture.publication_id,
  p_revision_id => fixture.revision_id,
  p_content_sha256 => fixture.content_sha256,
  p_snapshot => fixture.snapshot,
  p_asset_manifest => '[]'::jsonb,
  p_rights_confirmed => true,
  p_learning_audience => 'educators',
  p_attestation => fixture.attestation
)
from pg_temp.shidao_chinese_educator_fixture as fixture
where not exists (
  select 1
  from public.course_publication as publication
  join public.course_publication_revision as revision
    on revision.id = publication.current_revision_id
  join public.course_publication_attestation as persisted_attestation
    on persisted_attestation.publication_id = publication.id
    and persisted_attestation.revision_id = revision.id
  where publication.id = fixture.publication_id
    and publication.source_course_id = fixture.course_id
    and publication.owner_account_id = current_setting(
      'shidao.bootstrap.publisher_account_id'
    )::uuid
    and publication.status = 'published'
    and publication.learning_audience = 'educators'
    and publication.publisher_display_name = (
      select account.display_name
      from public.account as account
      where account.id = current_setting(
        'shidao.bootstrap.publisher_account_id'
      )::uuid
    )
    and publication.title = fixture.snapshot -> 'course' ->> 'title'
    and publication.subject = fixture.snapshot -> 'course' ->> 'subject'
    and publication.goal = fixture.snapshot -> 'course' ->> 'goal'
    and publication.level = fixture.snapshot -> 'course' ->> 'level'
    and publication.audience_description
      = fixture.snapshot -> 'course' ->> 'audienceDescription'
    and publication.target_lesson_count
      = (fixture.snapshot -> 'course' ->> 'targetLessonCount')::integer
    and publication.lesson_count = 6
    and publication.material_count = 0
    and revision.content_sha256 = fixture.content_sha256
    and revision.snapshot = fixture.snapshot
    and jsonb_build_object(
      'version', persisted_attestation.version,
      'title', persisted_attestation.title,
      'description', persisted_attestation.description,
      'passingScorePercent', persisted_attestation.passing_score_percent,
      'questions', persisted_attestation.questions
    ) = fixture.attestation
);

-- The wrapper may acknowledge an already-current equivalent revision. Resolve
-- the actual current revision before passing the stale-write token to scoring.
update pg_temp.shidao_chinese_educator_fixture as fixture
set revision_id = publication.current_revision_id
from public.course_publication as publication
where publication.id = fixture.publication_id
  and publication.source_course_id = fixture.course_id
  and publication.status = 'published'
  and publication.learning_audience = 'educators';

select
  account.auth_user_id::text as attested_auth_user_id
from public.account as account
join auth.users as auth_user on auth_user.id = account.auth_user_id
where account.id = current_setting(
    'shidao.bootstrap.attested_account_id'
  )::uuid
  and account.status = 'active'
\gset shidao_

select
  fixture.publication_id::text as fixture_publication_id,
  fixture.revision_id::text as fixture_revision_id,
  fixture.answers::text as fixture_answers
from pg_temp.shidao_chinese_educator_fixture as fixture
\gset shidao_

select set_config(
  'request.jwt.claim.sub',
  :'shidao_attested_auth_user_id',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.submit_my_course_publication_attestation(
  :'shidao_fixture_publication_id'::uuid,
  :'shidao_fixture_revision_id'::uuid,
  :'shidao_fixture_answers'::jsonb
) as attestation_result;

reset role;

do $bootstrap_postcondition$
declare
  v_fixture pg_temp.shidao_chinese_educator_fixture%rowtype;
  v_attempt public.course_attestation_attempt%rowtype;
  v_award public.course_attestation_award%rowtype;
  v_attested_account_id uuid := current_setting(
    'shidao.bootstrap.attested_account_id'
  )::uuid;
begin
  select fixture.*
  into strict v_fixture
  from pg_temp.shidao_chinese_educator_fixture as fixture;

  if (
    select count(*)
    from public.lesson as lesson
    where lesson.course_id = v_fixture.course_id
  ) <> 6
    or (
      select count(*)
      from public.lesson_component as component
      join public.lesson as lesson on lesson.id = component.lesson_id
      where lesson.course_id = v_fixture.course_id
    ) <> 6
    or (
      select count(*)
      from public.lesson_student_slide as slide
      join public.lesson as lesson on lesson.id = slide.lesson_id
      where lesson.course_id = v_fixture.course_id
    ) <> 6
  then
    raise exception 'bootstrap_course_graph_postcondition_failed'
      using errcode = '55000';
  end if;

  if jsonb_array_length(v_fixture.questions) <> 10
    or (v_fixture.attestation ->> 'passingScorePercent')::integer <> 80
    or v_fixture.answers ->> 'q8' <> 'q8_b'
    or not exists (
      select 1
      from jsonb_array_elements(v_fixture.questions) as question(value)
      where question.value ->> 'id' = 'q8'
        and question.value ->> 'correctOptionId' = 'q8_a'
    )
    or exists (
      select 1
      from jsonb_array_elements(v_fixture.questions) as question(value)
      where question.value ->> 'id' <> 'q8'
        and v_fixture.answers ->> (question.value ->> 'id')
          <> question.value ->> 'correctOptionId'
    )
  then
    raise exception 'bootstrap_assessment_fixture_postcondition_failed'
      using errcode = '55000';
  end if;

  select award.*
  into strict v_award
  from public.course_attestation_award as award
  where award.account_id = v_attested_account_id
    and award.publication_id = v_fixture.publication_id
    and award.revision_id = v_fixture.revision_id;

  select attempt.*
  into strict v_attempt
  from public.course_attestation_attempt as attempt
  where attempt.id = v_award.attempt_id;

  if v_attempt.account_id <> v_attested_account_id
    or v_attempt.question_count <> 10
    or v_attempt.correct_answer_count <> 9
    or v_attempt.score_percent <> 90
    or not v_attempt.passed
    or v_attempt.passing_score_percent <> 80
    or v_attempt.selected_option_by_question_id <> v_fixture.answers
    or v_award.score_percent <> 90
    or v_award.passing_score_percent <> 80
  then
    raise exception 'bootstrap_attestation_award_postcondition_failed'
      using errcode = '55000';
  end if;
end
$bootstrap_postcondition$;

select jsonb_build_object(
  'courseId', fixture.course_id,
  'publicationId', fixture.publication_id,
  'revisionId', fixture.revision_id,
  'lessonCount', 6,
  'assessmentQuestionCount', 10,
  'scorePercent', 90,
  'passingScorePercent', 80,
  'certified', true
) as bootstrap_result
from pg_temp.shidao_chinese_educator_fixture as fixture;

commit;
