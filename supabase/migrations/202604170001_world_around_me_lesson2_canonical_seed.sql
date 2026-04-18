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
  'Урок 2. Что это за животное?',
  1,
  1,
  2,
  '["鸭子","鸡子","羊","牛","房子","拍手","数","我","你"]'::jsonb,
  '["你是谁？","我是…","这是…","在…里","我住在房子里。"]'::jsonb,
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
  ('worksheet', 'worksheet:workbook-page-5', 'Рабочая тетрадь, стр. 5', 'Соедини числа и животных, назови вслух по модели «这是…».', null, '{}'::jsonb),
  ('worksheet', 'worksheet:appendix-2', 'Приложение 2', 'Пазлы с животными для счёта и называния.', null, '{}'::jsonb),
  ('media_file', 'media:masks-farm-animals', 'Маски животных фермы', 'Набор масок: 鸭子、鸡子、羊、牛 для командных игр.', '/methodologies/world-around-me/lesson-2/masks.svg', '{}'::jsonb)
on conflict (slug)
do update set
  kind = excluded.kind,
  title = excluded.title,
  description = excluded.description,
  file_ref = excluded.file_ref;

with lesson_two as (
  select ml.id
  from public.methodology_lesson ml
  join public.methodology m on m.id = ml.methodology_id
  where m.slug = 'world-around-me'
    and ml.module_index = 1
    and ml.unit_index = 1
    and ml.lesson_index = 2
  limit 1
),
block_source as (
  select *
  from (values
    (1, 'intro_framing', 'Приветствие детей и героев курса', '{"title":"Урок 2. Что это за животное?","goal":"Активно включить детей в урок и напомнить формат «играем и говорим по-китайски».","teacherScriptShort":"Поприветствуйте детей и героев курса, посадите группу в круг, задайте позитивный ритм.","warmupQuestion":"你是谁？","timeboxMinutes":3}'::jsonb),
    (2, 'video_segment', 'Видео farm animals', '{"promptBeforeWatch":"Смотрим farm animals и слушаем новые слова про животных фермы.","focusPoints":["鸭子","鸡子","羊","牛"],"questionsAfterWatch":["Кого ты услышал?","Кто говорит «му-у»?","Что ты запомнил?"]}'::jsonb),
    (3, 'teacher_prompt_pattern', 'Круговой паттерн «你是谁？— 我是…»', '{"promptPatterns":["你是谁？","我是…"],"expectedStudentResponses":["我是小鸭子。","我是小牛。"],"fallbackRu":"Если ребёнок теряется, предложите выбрать маску/картинку и договорить «我是…» вместе с вами."}'::jsonb),
    (4, 'song_segment', 'Песня hello', '{"activityGoal":"Закрепить ритуал начала занятия и настроить группу на совместную речь.","teacherActions":["Включите песню hello и спойте её вместе с детьми в круге."],"repeatCount":1,"movementHint":"Добавьте хлопки в ладоши и жест «привет» каждому ребёнку."}'::jsonb),
    (5, 'vocabulary_focus', 'Новые слова: животные фермы', '{"items":[{"term":"鸭子","pinyin":"yāzi","meaning":"утка"},{"term":"鸡子","pinyin":"jīzi","meaning":"курица"},{"term":"羊","pinyin":"yáng","meaning":"овца"},{"term":"牛","pinyin":"niú","meaning":"корова"}],"practiceMode":"cards_two_passes_then_sentence_model","miniDrill":"Проход 1: называем слово. Проход 2: с каждой карточкой говорим полную модель «这是…»."}'::jsonb),
    (6, 'guided_activity', 'Прыжки по карточкам', '{"activityType":"jump_and_name_cards","steps":["Разложите карточки 鸭子/鸡子/羊/牛 в ряд на полу.","Ребёнок прыгает на карточку, показывает на неё и говорит: «这是…».","Группа повторяет фразу хором после каждого прыжка."],"successCriteria":["Ребёнок уверенно соотносит карточку и слово.","Ребёнок произносит модель «这是…» в активном движении."],"timeboxMinutes":4}'::jsonb),
    (7, 'guided_activity', 'Угадай животное по звуку', '{"activityType":"animal_sound_guessing","steps":["Дети садятся в круг и слушают звуки животных.","После каждого звука задайте вопрос: «这是什么？».","Дети отвечают словом животного или фразой «这是牛。»."],"successCriteria":["Дети распознают животное на слух.","Дети пробуют отвечать словами урока без подсказки на карточке."],"timeboxMinutes":3}'::jsonb),
    (8, 'teacher_prompt_pattern', 'Команды 跑 / 跳 / 拍手 / 数', '{"promptPatterns":["我们跑吧！","我们跳吧！","拍手吧！","我们数吧！"],"expectedStudentResponses":["Дети выполняют движение и проговаривают глагол.","Дети считают до 5, хлопая и прыгая."],"fallbackRu":"Сначала выполните команду сами, затем подключите группу и добавьте счёт «一、二、三、四、五»."}'::jsonb),
    (9, 'guided_activity', 'Считаем игрушки животных', '{"activityType":"counting_with_soft_toys","steps":["Посадите детей в круг и разложите игрушки (собака, кот, кролик, лошадь).","Считайте вместе до 5, по очереди показывая игрушки и называя животных.","Попросите детей повторить счёт и назвать одно животное самостоятельно."],"successCriteria":["Дети держат ритм счёта до 5.","Дети совмещают счёт с называнием животного."],"timeboxMinutes":3}'::jsonb),
    (10, 'guided_activity', 'Приложение 2: пазлы животных', '{"activityType":"appendix_puzzle_count_and_name","steps":["Раздайте детям элементы Приложения 2.","Попросите собрать пазл и назвать животное на картинке.","После сборки дети считают животных вслух по одному."],"successCriteria":["Ребёнок называет хотя бы 1–2 животных из урока.","Ребёнок участвует в счёте и слышит ответы одногруппников."],"timeboxMinutes":4}'::jsonb),
    (11, 'guided_activity', 'Маски и команды', '{"activityType":"mask_roleplay_commands","steps":["Раздайте маски утки, курицы, овцы и коровы.","Давайте команды в игровом формате: «鸭子，跑吧！», «鸡子，拍手吧！».","Меняйте роли, чтобы каждый ребёнок выполнил минимум 2 команды."],"successCriteria":["Дети реагируют на адресную команду.","Дети закрепляют глаголы 跑 / 跳 / 拍手."],"timeboxMinutes":4}'::jsonb),
    (12, 'worksheet_task', 'Рабочая тетрадь: страница 5', '{"taskInstruction":"Откройте стр. 5 и соедините числа с животными. После соединения проговорите «这是…».","completionMode":"in_class","answerKeyHint":"Проверяйте устно: ребёнок показывает линию и произносит название животного."}'::jsonb),
    (13, 'vocabulary_focus', 'Слово 房子', '{"items":[{"term":"房子","pinyin":"fángzi","meaning":"дом"}],"practiceMode":"single_card_with_context","miniDrill":"Покажите карточку 房子 и попросите детей повторить слово с жестом «домик» руками."}'::jsonb),
    (14, 'guided_activity', 'Игрушечный дом: 我 / 你 / 在…里', '{"activityType":"toy_house_phrase_practice","steps":["Поставьте игрушечный дом и маленькие фигурки.","Моделируйте фразы: «我住在房子里。», «你在房子里吗？».","Попросите детей по очереди поместить фигурку в дом и проговорить короткую фразу."],"successCriteria":["Дети распознают слова 我 / 你 / 房子.","Дети повторяют модель 在…里 в мини-ситуации."],"timeboxMinutes":4}'::jsonb),
    (15, 'song_segment', 'Песня farm animals', '{"activityGoal":"Завершить урок в знакомом ритуале и закрепить новые слова о животных.","teacherActions":["Включите farm animals, пойте вместе и показывайте карточки животных."],"repeatCount":1,"movementHint":"Добавьте хлопки и прыжки на знакомых словах."}'::jsonb),
    (16, 'wrap_up_closure', 'Прощание с детьми и героями', '{"recapPoints":["鸭子","鸡子","羊","牛","房子","我是…","这是…","拍手","数","在…里"],"exitCheck":"Перед прощанием каждый ребёнок называет 1 животное и 1 действие, затем говорит короткую фразу с «这是…».","teacherReflectionPrompt":"Попрощайтесь вместе с героями курса и отметьте детей за участие в играх."}'::jsonb),
    (17, 'materials_prep', 'Материалы урока 2', '{"materialsChecklist":["герои курса","карточки 鸭子/鸡子/羊/牛","карточка 房子","аудио со звуками животных","мягкие игрушки: собака, кот, кролик, лошадь","Приложение 2 (пазлы)","маски утки/курицы/овцы/коровы","рабочая тетрадь (стр. 5)","игрушечный дом"],"roomSetupNotes":"Подготовьте две зоны: активную (прыжки/команды) и спокойную (пазлы/тетрадь), чтобы сохранить чередование темпа урока."}'::jsonb)
  ) as s(sort_order, block_type, title, content)
),
upsert_blocks as (
  insert into public.methodology_lesson_block (methodology_lesson_id, block_type, sort_order, title, content)
  select lt.id, bs.block_type, bs.sort_order, bs.title, bs.content
  from lesson_two lt
  cross join block_source bs
  on conflict (methodology_lesson_id, sort_order)
  do update set
    block_type = excluded.block_type,
    title = excluded.title,
    content = excluded.content
  returning id, methodology_lesson_id, sort_order
)
insert into public.methodology_lesson_block_asset (methodology_lesson_block_id, reusable_asset_id, sort_order)
select
  b.id,
  a.id,
  m.asset_sort_order
from upsert_blocks b
join (
  values
    (2, 'video:farm-animals', 0),
    (4, 'song:hello', 0),
    (10, 'worksheet:appendix-2', 0),
    (11, 'media:masks-farm-animals', 0),
    (12, 'worksheet:workbook-page-5', 0),
    (15, 'song:farm-animals', 0),
    (17, 'worksheet:appendix-2', 0),
    (17, 'worksheet:workbook-page-5', 1),
    (17, 'media:masks-farm-animals', 2)
) as m(sort_order, asset_slug, asset_sort_order)
  on m.sort_order = b.sort_order
join public.reusable_asset a on a.slug = m.asset_slug
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
  'Мини-миссия: Угадай животное и дом',
  'quiz_single_choice',
  'Повтори слова урока 2. Слушай вопрос, выбирай правильный ответ и помоги героям найти животных и дом.',
  '["Рабочая тетрадь, стр. 5", "Карточки 鸭子/鸡子/羊/牛/房子"]'::jsonb,
  '6 коротких вопросов, по одному ответу.',
  6,
  '{
    "id":"world-around-me-lesson-2-quiz",
    "version":1,
    "questions":[
      {"id":"q1","prompt":"Как по-китайски «утка»?","options":[{"id":"a","label":"鸭子"},{"id":"b","label":"羊"},{"id":"c","label":"牛"}],"correctOptionId":"a"},
      {"id":"q2","prompt":"Что значит 房子?","options":[{"id":"a","label":"овца"},{"id":"b","label":"дом"},{"id":"c","label":"курица"}],"correctOptionId":"b"},
      {"id":"q3","prompt":"Выбери фразу «Это корова».","options":[{"id":"a","label":"我是牛。"},{"id":"b","label":"这是牛。"},{"id":"c","label":"你是牛。"}],"correctOptionId":"b"},
      {"id":"q4","prompt":"Какое слово — команда «хлопай»?","options":[{"id":"a","label":"拍手"},{"id":"b","label":"数"},{"id":"c","label":"跳"}],"correctOptionId":"a"},
      {"id":"q5","prompt":"Какое слово значит «считать»?","options":[{"id":"a","label":"你"},{"id":"b","label":"我"},{"id":"c","label":"数"}],"correctOptionId":"c"},
      {"id":"q6","prompt":"Выбери правильную фразу про дом.","helperText":"Где я живу?","options":[{"id":"a","label":"我住在房子里。"},{"id":"b","label":"你住在羊里。"},{"id":"c","label":"这是我里。"}],"correctOptionId":"a"}
    ]
  }'::jsonb
from public.methodology_lesson ml
join public.methodology m on m.id = ml.methodology_id
where m.slug = 'world-around-me'
  and ml.module_index = 1
  and ml.unit_index = 1
  and ml.lesson_index = 2
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
  'Урок 2. Что это за животное?',
  'Новые животные фермы: слушаем, угадываем, двигаемся и говорим фразами.',
  '{
    "sections":[
      {"type":"lesson_focus","title":"Урок 2 · Что это за животное?","subtitle":"Сяо Лон и Сяо Мей зовут нас на ферму знакомиться с новыми друзьями.","body":"Сегодня мы будем говорить, двигаться, угадывать звуки и играть с масками животных.","chips":["鸭子","鸡子","羊","牛"],"tone":"sky","layout":"hero","illustrationSrc":"/methodologies/world-around-me/lesson-2/farm-scene-2.svg","sceneId":"scene-hero"},
      {"type":"lesson_focus","title":"Что мы делаем сегодня","body":"Смотрим видео, угадываем звуки, хлопаем и считаем, играем с масками, делаем страницу 5 и поём.","chips":["смотреть","угадывать","хлопать","считать","петь"],"tone":"violet","layout":"roadmap","sceneId":"scene-roadmap"},
      {"type":"vocabulary_cards","title":"Новые животные фермы","subtitle":"Слушай, повторяй и покажи карточку.","tone":"amber","layout":"vocabulary","sceneId":"scene-vocabulary","items":[{"term":"鸭子","pinyin":"yāzi","meaning":"утка","visualHint":"Покажи крылышки и скажи: yāzi!","illustrationSrc":"/methodologies/world-around-me/lesson-2/duck.svg"},{"term":"鸡子","pinyin":"jīzi","meaning":"курица","visualHint":"Скажи громко: jīzi!","illustrationSrc":"/methodologies/world-around-me/lesson-2/chicken.svg"},{"term":"羊","pinyin":"yáng","meaning":"овца","visualHint":"Сложи руки как пушистую овечку.","illustrationSrc":"/methodologies/world-around-me/lesson-2/sheep.svg"},{"term":"牛","pinyin":"niú","meaning":"корова","visualHint":"Покажи рога и скажи: niú!","illustrationSrc":"/methodologies/world-around-me/lesson-2/cow.svg"}]},
      {"type":"phrase_cards","title":"Говорим фразами","subtitle":"Скажи кто ты и что на карточке.","tone":"violet","layout":"phrases","sceneId":"scene-speaking","items":[{"phrase":"我是…","pinyin":"wǒ shì…","meaning":"Я…","usageHint":"Выбери животное и представься.","example":"我是小羊。"},{"phrase":"这是…","pinyin":"zhè shì…","meaning":"Это…","usageHint":"Покажи карточку и назови животное.","example":"这是鸭子。"}]},
      {"type":"lesson_focus","title":"Слушай звук и угадай","subtitle":"Какое животное так звучит?","body":"Слушай звук внимательно и отвечай: «这是…».","chips":["слушай","угадывай","отвечай"],"tone":"sky","layout":"practice","illustrationSrc":"/methodologies/world-around-me/lesson-2/sounds.svg","sceneId":"scene-sounds"},
      {"type":"action_cards","title":"Двигаемся и считаем","subtitle":"跑 · 跳 · 拍手 · 数","tone":"emerald","layout":"movement","sceneId":"scene-actions","items":[{"term":"跑","pinyin":"pǎo","meaning":"бежать","movementHint":"我们跑吧！","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/run-action.png"},{"term":"跳","pinyin":"tiào","meaning":"прыгать","movementHint":"我们跳吧！","illustrationSrc":"/methodologies/world-around-me/lesson-1/visuals/jump-action.png"},{"term":"拍手","pinyin":"pāishǒu","meaning":"хлопать в ладоши","movementHint":"拍手吧！ 一、二、三、四、五。","illustrationSrc":"/methodologies/world-around-me/lesson-2/clap.svg"},{"term":"数","pinyin":"shǔ","meaning":"считать","movementHint":"我们数吧！","illustrationSrc":"/methodologies/world-around-me/lesson-2/count.svg"}]},
      {"type":"lesson_focus","title":"Маски и команды","subtitle":"Играй роль животного и слушай команду.","body":"Надень маску и выполняй: «鸭子，跑吧！», «鸡子，拍手吧！».","chips":["маска","команда","игра"],"tone":"amber","layout":"practice","illustrationSrc":"/methodologies/world-around-me/lesson-2/masks.svg","sceneId":"scene-masks"},
      {"type":"phrase_cards","title":"Домик и новые слова","subtitle":"我 · 你 · 房子 · 在…里","tone":"amber","layout":"farm","illustrationSrc":"/methodologies/world-around-me/lesson-2/house.svg","sceneId":"scene-house","items":[{"phrase":"房子","pinyin":"fángzi","meaning":"дом","usageHint":"Покажи карточку домика."},{"phrase":"我","pinyin":"wǒ","meaning":"я","usageHint":"Скажи о себе."},{"phrase":"你","pinyin":"nǐ","meaning":"ты","usageHint":"Спроси друга: «你是谁？»."},{"phrase":"在…里","pinyin":"zài…lǐ","meaning":"внутри / в","usageHint":"Покажи, кто находится в домике.","example":"我住在房子里。"}]},
      {"type":"worksheet","title":"Тетрадь и песня","subtitle":"Спокойное закрепление перед финалом.","tone":"rose","layout":"practice","sceneId":"scene-workbook-song","illustrationSrc":"/methodologies/world-around-me/lesson-2/workbook.svg","pageLabel":"Рабочая тетрадь · стр. 5","instructions":"Соедини числа с животными, назови их, а потом спой песню farm animals с группой.","teacherHint":"После задания попросите каждого ребёнка назвать одну пару «число + животное».","assetId":"worksheet:workbook-page-5"},
      {"type":"recap","title":"Повтор дома","subtitle":"Мини-итог после урока.","tone":"neutral","layout":"recap","sceneId":"scene-home-review","bullets":["Назови 4 животных: 鸭子, 鸡子, 羊, 牛.","Скажи 2 фразы: 我是… и 这是…","Покажи действия: 跑, 跳, 拍手.","Скажи слово 数 и посчитай до 5.","Произнеси: 我住在房子里。"]}
    ]
  }'::jsonb
from public.methodology_lesson ml
join public.methodology m on m.id = ml.methodology_id
where m.slug = 'world-around-me'
  and ml.module_index = 1
  and ml.unit_index = 1
  and ml.lesson_index = 2
on conflict (methodology_lesson_id)
do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  content_payload = excluded.content_payload;

commit;
