begin;

with target_methodology as (
  select id
  from public.methodology
  where slug = 'world-around-me'
  limit 1
)
insert into public.methodology_lesson (
  methodology_id,
  title,
  module_index,
  unit_index,
  lesson_index,
  vocabulary_summary,
  phrase_summary,
  estimated_duration_minutes,
  readiness_status
)
select
  tm.id,
  'Урок 3. Этот разноцветный мир',
  1,
  1,
  3,
  '["红色","绿色","蓝色","黄色","车","只","…的…","次"]'::jsonb,
  '["你是…","我是谁？","这是红色。","这是狗。","我们在做什么？","我们在开车。","红色的车。"]'::jsonb,
  45,
  'ready'
from target_methodology tm
on conflict (methodology_id, module_index, unit_index, lesson_index)
do update set
  title = excluded.title,
  vocabulary_summary = excluded.vocabulary_summary,
  phrase_summary = excluded.phrase_summary,
  estimated_duration_minutes = excluded.estimated_duration_minutes,
  readiness_status = excluded.readiness_status;

insert into public.reusable_asset (kind, slug, title, description, file_ref, metadata)
values
  ('song', 'song:hello', 'hello', 'Песня-приветствие для начала урока 2.', null, '{}'::jsonb),
  ('video', 'video:colors', 'colors', 'Видео-сегмент урока 3: знакомство с цветами.', null, '{}'::jsonb),
  ('song', 'song:my-favorite-color-is-blue', 'my favorite color is blue', 'Песня для финала урока 3 о любимом цвете.', null, '{}'::jsonb),
  ('worksheet', 'worksheet:appendix-3', 'Приложение 3', 'Сортировка животных по цветам с цветным кубиком.', null, '{}'::jsonb),
  ('worksheet', 'worksheet:workbook-page-6', 'Рабочая тетрадь, стр. 6', 'Раскрась цвета и назови их по-китайски.', null, '{}'::jsonb),
  ('media_file', 'media:color-cards', 'Карточки цветов', 'Набор карточек 红色、绿色、蓝色、黄色.', '/methodologies/world-around-me/lesson-3/color-cards.svg', '{}'::jsonb),
  ('media_file', 'media:animals-bag', 'Мешочек с игрушечными животными', 'Игровой реквизит для модели «两只狗 / 三只猫».', '/methodologies/world-around-me/lesson-3/animals-bag.svg', '{}'::jsonb),
  ('media_file', 'media:car-silhouette', 'Силуэт машины', 'Картонный силуэт машины для моделей «…的车».', '/methodologies/world-around-me/lesson-3/car-silhouette.svg', '{}'::jsonb),
  ('media_file', 'media:color-die', 'Цветной кубик', 'Кубик цветов для сортировки животных по цвету.', '/methodologies/world-around-me/lesson-3/color-die.svg', '{}'::jsonb)
on conflict (slug)
do update set
  kind = excluded.kind,
  title = excluded.title,
  description = excluded.description,
  file_ref = excluded.file_ref;

with lesson_three as (
  select ml.id
  from public.methodology_lesson ml
  join public.methodology m on m.id = ml.methodology_id
  where m.slug = 'world-around-me'
    and ml.module_index = 1
    and ml.unit_index = 1
    and ml.lesson_index = 3
  limit 1
),
block_source as (
  select *
  from (values
    (1, 'intro_framing', 'Приветствие детей и героев курса', '{"title":"Урок 3. Этот разноцветный мир","goal":"Включить детей в тему цветов и напомнить игровой ритм урока.","teacherScriptShort":"Поприветствуйте детей и героев курса, соберите группу в круг и объявите цветное приключение.","timeboxMinutes":3}'::jsonb),
    (2, 'video_segment', 'Видео colors', '{"promptBeforeWatch":"Смотрим видео colors и слушаем названия цветов.","focusPoints":["红色","绿色","蓝色","黄色"],"questionsAfterWatch":["Какой цвет ты услышал?","Покажи любимый цвет руками."]}'::jsonb),
    (3, 'teacher_prompt_pattern', 'Круг «你是… / 我是谁？»', '{"promptPatterns":["你是…","我是谁？"],"expectedStudentResponses":["你是…"],"fallbackRu":"Покажите на ребёнка и мягко дайте начало фразы, чтобы он завершил «你是…»."}'::jsonb),
    (4, 'song_segment', 'Песня hello', '{"activityGoal":"Сохранить ритуал начала урока и общий темп группы.","teacherActions":["Спойте hello song в круге вместе с детьми и героями курса."],"repeatCount":1,"movementHint":"Добавьте мягкие жесты приветствия и хлопки в ритме песни."}'::jsonb),
    (5, 'vocabulary_focus', 'Цвета: 红色 / 绿色 / 蓝色 / 黄色', '{"items":[{"term":"红色","pinyin":"hóngsè","meaning":"красный"},{"term":"绿色","pinyin":"lǜsè","meaning":"зелёный"},{"term":"蓝色","pinyin":"lánsè","meaning":"синий"},{"term":"黄色","pinyin":"huángsè","meaning":"жёлтый"}],"practiceMode":"cards_two_passes_then_phrase_model","miniDrill":"Проход 1: называем слово. Проход 2: говорим полной фразой «这是红色。» и аналогично для других цветов."}'::jsonb),
    (6, 'guided_activity', 'Палочки и карточки: коснись нужного цвета', '{"activityType":"color_touch_with_sticks","steps":["Разложите карточки 红色/绿色/蓝色/黄色 в ряд.","Раздайте детям цветные палочки.","Называйте цвет: ребёнок касается карточки палочкой и повторяет слово."],"successCriteria":["Ребёнок находит нужный цвет по аудиокоманде.","Ребёнок проговаривает цвет после действия."],"timeboxMinutes":4}'::jsonb),
    (7, 'guided_activity', 'Найди в классе предмет нужного цвета', '{"activityType":"bring_objects_by_color","steps":["Разместите по классу предметы зелёного, синего, жёлтого и красного цветов.","Называйте цвет, дети находят предмет и приносят в корзину.","Перед тем как положить предмет, ребёнок самостоятельно называет цвет."],"successCriteria":["Ребёнок узнаёт и приносит предмет нужного цвета.","Ребёнок произносит цвет без подсказки."],"timeboxMinutes":4}'::jsonb),
    (8, 'guided_activity', 'Мешочек животных: 这是狗 / 两只狗 / 三只猫', '{"activityType":"animal_bag_classifier_count","steps":["Повторите животных по карточкам: 狗、猫、兔子、马、鸭子、鸡子、羊、牛.","Дети по очереди достают игрушки из мешочка и говорят: «这是狗。»","В конце мини-раунда ребёнок считает и подводит итог с 只: «两只狗», «三只猫»."],"successCriteria":["Ребёнок называет животное по модели «这是…».","Ребёнок использует классификатор 只 в короткой счётной фразе."],"timeboxMinutes":5}'::jsonb),
    (9, 'vocabulary_focus', 'Новое слово 车', '{"items":[{"term":"车","pinyin":"chē","meaning":"машина"}],"practiceMode":"single_card_with_object_link","miniDrill":"Покажите карточку 车, затем игрушечную машину и проговорите слово хором."}'::jsonb),
    (10, 'guided_activity', 'Игра с машинками: 我们在做什么？我们在开车。', '{"activityType":"toy_car_action_commentary","steps":["Раздайте детям игрушечные машинки и задайте вопрос: «我们在做什么？».","Смоделируйте ответ: «我们在开车。».","Попросите детей катать машинки и повторять полную фразу."],"successCriteria":["Дети отвечают на вопрос готовой моделью.","Дети связывают действие и фразу «我们在开车。»."],"timeboxMinutes":4}'::jsonb),
    (11, 'guided_activity', 'Силуэт машины и модель «…的车»', '{"activityType":"car_silhouette_color_phrase","steps":["Покажите картонный силуэт машины с окошком.","По очереди вставляйте цветные карточки в силуэт.","Комментируйте и просите повторить: «红色的车。», «绿色的车。»."],"successCriteria":["Ребёнок повторяет модель «…的车».","Ребёнок соединяет цвет и предмет в единую фразу."],"timeboxMinutes":4}'::jsonb),
    (12, 'guided_activity', 'Приложение 3: сортировка животных по цвету', '{"activityType":"appendix_color_sorting_with_die","steps":["Используйте Приложение 3 и цветной кубик.","Ребёнок бросает кубик и узнаёт целевой цвет.","Ребёнок выбирает животных нужного цвета и называет: «黄色的猫。», «绿色的牛。»."],"successCriteria":["Ребёнок сортирует карточки животных по цвету.","Ребёнок проговаривает словосочетание с «…的…»."],"timeboxMinutes":5}'::jsonb),
    (13, 'guided_activity', 'Движение и счёт с 次', '{"activityType":"counted_actions_with_ci","steps":["Повторите знакомые глаголы движения и хлопков.","Давайте команды с числом: «跳五次。», «拍手三次。».","Дети выполняют действие и считают вслух до 5."],"successCriteria":["Ребёнок понимает модель «число + 次».","Ребёнок выполняет и считает нужное количество раз."],"timeboxMinutes":4}'::jsonb),
    (14, 'worksheet_task', 'Рабочая тетрадь: страница 6', '{"taskInstruction":"Раскрась цвета на странице 6 и назови каждый цвет по-китайски.","completionMode":"in_class","answerKeyHint":"Проверка устно: ребёнок показывает цвет и произносит «这是红色。» или аналогичную фразу."}'::jsonb),
    (15, 'song_segment', 'Песня my favorite color is blue', '{"activityGoal":"Закрепить цвета и завершить урок эмоционально.","teacherActions":["Включите песню my favorite color is blue и подпевайте с детьми."],"repeatCount":1,"movementHint":"Поднимайте карточку того цвета, который звучит в песне."}'::jsonb),
    (16, 'wrap_up_closure', 'Прощание с детьми и героями', '{"recapPoints":["红色","绿色","蓝色","黄色","车","你是…","我是谁？","…的…","只","次"],"exitCheck":"Перед прощанием каждый ребёнок называет один цвет, одну фразу с «…的…» и выполняет короткую команду с 次.","teacherReflectionPrompt":"Попрощайтесь вместе с героями и отметьте детей за смелую речь полными фразами."}'::jsonb),
    (17, 'materials_prep', 'Материалы урока 3', '{"materialsChecklist":["герои курса","видео colors","карточки 红色/绿色/蓝色/黄色/车","цветные палочки","предметы 4 цветов для игры по классу","карточки и игрушки животных в мешочке","игрушечные машинки","картонный силуэт машины","Приложение 3","цветной кубик","рабочая тетрадь (стр. 6)"],"roomSetupNotes":"Подготовьте активную зону поиска предметов и спокойную зону для сортировки/тетради; заранее проверьте, что цветные карточки видны всем детям."}'::jsonb)
  ) as s(sort_order, block_type, title, content)
),
upsert_blocks as (
  insert into public.methodology_lesson_block (methodology_lesson_id, block_type, sort_order, title, content)
  select lt.id, bs.block_type, bs.sort_order, bs.title, bs.content
  from lesson_three lt
  cross join block_source bs
  on conflict (methodology_lesson_id, sort_order)
  do update set
    block_type = excluded.block_type,
    title = excluded.title,
    content = excluded.content
  returning id, methodology_lesson_id, sort_order
),
desired_block_assets as (
  select
    b.id as methodology_lesson_block_id,
    a.id as reusable_asset_id,
    m.asset_sort_order
  from upsert_blocks b
  join (
    values
      (2, 'video:colors', 0),
      (4, 'song:hello', 0),
      (5, 'media:color-cards', 0),
      (6, 'media:color-cards', 0),
      (8, 'media:animals-bag', 0),
      (11, 'media:car-silhouette', 0),
      (12, 'worksheet:appendix-3', 0),
      (12, 'media:color-die', 1),
      (14, 'worksheet:workbook-page-6', 0),
      (15, 'song:my-favorite-color-is-blue', 0),
      (17, 'media:color-cards', 0),
      (17, 'media:animals-bag', 1),
      (17, 'media:car-silhouette', 2),
      (17, 'worksheet:appendix-3', 3),
      (17, 'worksheet:workbook-page-6', 4),
      (17, 'media:color-die', 5)
  ) as m(sort_order, asset_slug, asset_sort_order)
    on m.sort_order = b.sort_order
  join public.reusable_asset a on a.slug = m.asset_slug
)
delete from public.methodology_lesson_block_asset mba
using upsert_blocks b
where mba.methodology_lesson_block_id = b.id
  and not exists (
    select 1
    from desired_block_assets dba
    where dba.methodology_lesson_block_id = mba.methodology_lesson_block_id
      and dba.reusable_asset_id = mba.reusable_asset_id
  );

insert into public.methodology_lesson_block_asset (methodology_lesson_block_id, reusable_asset_id, sort_order)
select methodology_lesson_block_id, reusable_asset_id, asset_sort_order
from desired_block_assets
on conflict (methodology_lesson_block_id, reusable_asset_id)
do update set
  sort_order = excluded.sort_order;

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
  ml.id,
  'Мини-миссия: Вспоминаем цвета и машинки',
  'quiz_single_choice',
  'Повтори цвета, машинки и короткие фразы урока 3. Выбери правильный ответ в каждом вопросе.',
  '["Рабочая тетрадь, стр. 6", "Карточки 红色/绿色/蓝色/黄色/车"]'::jsonb,
  '6 коротких вопросов, по одному ответу.',
  6,
  '{
    "id":"world-around-me-lesson-3-quiz",
    "version":1,
    "questions":[
      {"id":"q1","prompt":"Как по-китайски «красный»?","options":[{"id":"a","label":"红色"},{"id":"b","label":"绿色"},{"id":"c","label":"蓝色"}],"correctOptionId":"a"},
      {"id":"q2","prompt":"Какое слово значит «машина»?","options":[{"id":"a","label":"只"},{"id":"b","label":"车"},{"id":"c","label":"次"}],"correctOptionId":"b"},
      {"id":"q3","prompt":"Выбери правильную фразу:","helperText":"«Мы ведём машину.»","options":[{"id":"a","label":"我们在开车。"},{"id":"b","label":"我们在跳车。"},{"id":"c","label":"我们是谁？"}],"correctOptionId":"a"},
      {"id":"q4","prompt":"Выбери словосочетание «зелёная машина».","options":[{"id":"a","label":"绿色的车"},{"id":"b","label":"车的绿色"},{"id":"c","label":"绿色在车"}],"correctOptionId":"a"},
      {"id":"q5","prompt":"В какой фразе правильно используется 只?","options":[{"id":"a","label":"三次猫"},{"id":"b","label":"两只狗"},{"id":"c","label":"狗的两"}],"correctOptionId":"b"},
      {"id":"q6","prompt":"Выбери команду «Прыгни пять раз».","options":[{"id":"a","label":"拍手三次。"},{"id":"b","label":"跳五次。"},{"id":"c","label":"跳五只。"}],"correctOptionId":"b"}
    ]
  }'::jsonb
from public.methodology_lesson ml
join public.methodology m on m.id = ml.methodology_id
where m.slug = 'world-around-me'
  and ml.module_index = 1
  and ml.unit_index = 1
  and ml.lesson_index = 3
on conflict (methodology_lesson_id)
do update set
  title = excluded.title,
  kind = excluded.kind,
  instructions = excluded.instructions,
  material_links = excluded.material_links,
  answer_format_hint = excluded.answer_format_hint,
  estimated_minutes = excluded.estimated_minutes,
  quiz_payload = excluded.quiz_payload;

insert into public.methodology_lesson_student_content (
  methodology_lesson_id,
  title,
  subtitle,
  content_payload
)
select
  ml.id,
  'Урок 3. Этот разноцветный мир',
  'Изучаем цвета, играем с животными и машинками, считаем и поём.',
  '{
    "sections":[
      {"type":"lesson_focus","title":"Урок 3 · Этот разноцветный мир","subtitle":"Сяо Лон и Сяо Мей приглашают нас в мир ярких цветов.","body":"Сегодня мы смотрим видео colors, играем с карточками и учимся говорить цветные фразы.","chips":["红色","绿色","蓝色","黄色"],"tone":"sky","layout":"hero","illustrationSrc":"/methodologies/world-around-me/lesson-3/color-world.svg","sceneId":"scene-hero"},
      {"type":"lesson_focus","title":"Что мы делаем сегодня","body":"Смотрим видео, называем цвета, ищем цвета в классе, сортируем животных, играем с машинками и поём.","chips":["смотреть","называть","искать","сортировать","петь"],"tone":"violet","layout":"roadmap","sceneId":"scene-roadmap"},
      {"type":"vocabulary_cards","title":"Главные цвета","subtitle":"Слушай и повторяй каждый цвет.","tone":"amber","layout":"vocabulary","sceneId":"scene-colors","items":[{"term":"红色","pinyin":"hóngsè","meaning":"красный","visualHint":"Покажи красный цвет вокруг себя."},{"term":"绿色","pinyin":"lǜsè","meaning":"зелёный","visualHint":"Найди что-то зелёное."},{"term":"蓝色","pinyin":"lánsè","meaning":"синий","visualHint":"Покажи синий предмет."},{"term":"黄色","pinyin":"huángsè","meaning":"жёлтый","visualHint":"Улыбнись как жёлтое солнышко."}]},
      {"type":"phrase_cards","title":"Говорим и показываем","subtitle":"Играем в кругу с вопросом и ответом.","tone":"violet","layout":"phrases","sceneId":"scene-speaking","items":[{"phrase":"你是…","pinyin":"nǐ shì…","meaning":"Ты…","usageHint":"Покажи на друга и начни фразу."},{"phrase":"我是谁？","pinyin":"wǒ shì shéi?","meaning":"Кто я?","usageHint":"Спроси и послушай ответ друга."}]},
      {"type":"phrase_cards","title":"Животные и счёт","subtitle":"Называем и считаем с 只.","tone":"emerald","layout":"farm","illustrationSrc":"/methodologies/world-around-me/lesson-3/animals-bag.svg","sceneId":"scene-animals","items":[{"phrase":"这是狗。","pinyin":"zhè shì gǒu.","meaning":"Это собака.","usageHint":"Скажи, когда достаёшь игрушку из мешочка."},{"phrase":"两只狗。","pinyin":"liǎng zhī gǒu.","meaning":"Две собаки.","usageHint":"Посчитай, сколько собак у тебя."},{"phrase":"三只猫。","pinyin":"sān zhī māo.","meaning":"Три кошки.","usageHint":"Назови итог с числом и 只."}]},
      {"type":"phrase_cards","title":"Машинки","subtitle":"Учимся говорить о машинах и цветах.","tone":"amber","layout":"practice","illustrationSrc":"/methodologies/world-around-me/lesson-3/toy-car.svg","sceneId":"scene-cars","items":[{"phrase":"车","pinyin":"chē","meaning":"машина","usageHint":"Покажи игрушечную машину."},{"phrase":"我们在开车。","pinyin":"wǒmen zài kāichē.","meaning":"Мы ведём машину.","usageHint":"Скажи, когда играешь с машинкой."},{"phrase":"红色的车。","pinyin":"hóngsè de chē.","meaning":"Красная машина.","usageHint":"Подбери цвет и назови машину."},{"phrase":"绿色的车。","pinyin":"lǜsè de chē.","meaning":"Зелёная машина.","usageHint":"Сравни с другой машиной."}]},
      {"type":"phrase_cards","title":"Сортируем по цветам","subtitle":"Бросаем кубик цвета и ищем животных.","tone":"sky","layout":"practice","illustrationSrc":"/methodologies/world-around-me/lesson-3/color-die.svg","sceneId":"scene-sorting","items":[{"phrase":"黄色的猫。","pinyin":"huángsè de māo.","meaning":"Жёлтая кошка.","usageHint":"Назови животное нужного цвета."},{"phrase":"绿色的牛。","pinyin":"lǜsè de niú.","meaning":"Зелёная корова.","usageHint":"Скажи фразу после броска кубика."}]},
      {"type":"action_cards","title":"Считаем действия","subtitle":"Двигаемся с числом и 次.","tone":"emerald","layout":"movement","sceneId":"scene-actions","items":[{"term":"跳五次","pinyin":"tiào wǔ cì","meaning":"прыгни 5 раз","movementHint":"Прыгаем и считаем до пяти."},{"term":"拍手三次","pinyin":"pāishǒu sān cì","meaning":"хлопни 3 раза","movementHint":"Хлопай в ладоши и считай до трёх."}]},
      {"type":"worksheet","title":"Тетрадь и песня","subtitle":"Спокойный финал перед прощанием.","tone":"rose","layout":"practice","sceneId":"scene-workbook-song","illustrationSrc":"/methodologies/world-around-me/lesson-3/workbook.svg","pageLabel":"Рабочая тетрадь · стр. 6","instructions":"Раскрась цвета на стр. 6, произнеси каждый цвет и вместе спой my favorite color is blue.","teacherHint":"Попросите детей показать любимый цвет и назвать его вслух.","assetId":"worksheet:workbook-page-6"},
      {"type":"recap","title":"Повтор дома","subtitle":"Мини-итог перед домашней мини-миссией.","tone":"neutral","layout":"recap","sceneId":"scene-home-review","bullets":["Назови 4 цвета: 红色, 绿色, 蓝色, 黄色.","Скажи фразу: 这是红色。","Скажи про машинку: 红色的车 / 绿色的车.","Повтори счёт с 只: 两只狗, 三只猫.","Сделай 2 команды: 跳五次, 拍手三次."]}
    ]
  }'::jsonb
from public.methodology_lesson ml
join public.methodology m on m.id = ml.methodology_id
where m.slug = 'world-around-me'
  and ml.module_index = 1
  and ml.unit_index = 1
  and ml.lesson_index = 3
on conflict (methodology_lesson_id)
do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  content_payload = excluded.content_payload;

commit;
