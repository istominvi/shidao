export type MethodologyDescriptionSection =
  | {
      type: "rich_text";
      id: string;
      title: string;
      paragraphs: string[];
    }
  | {
      type: "bullets";
      id: string;
      title: string;
      items: string[];
    }
  | {
      type: "fact_cards";
      id: string;
      title: string;
      cards: Array<{
        title: string;
        description: string;
        icon: "book" | "music" | "video" | "users" | "clock" | "sparkles";
      }>;
    }
  | {
      type: "grouped_bullets";
      id: string;
      title: string;
      groups: Array<{
        title: string;
        items: string[];
      }>;
    }
  | {
      type: "anatomy_flow";
      id: string;
      title: string;
      stages: Array<{
        title: string;
        description: string;
        timeHint?: string;
      }>;
    }
  | {
      type: "numbered_list";
      id: string;
      title: string;
      items: string[];
    };

export type MethodologyDescriptionContent = {
  methodologySlug: string;
  lead: string;
  introParagraphs: string[];
  passportFacts: Array<{ label: string; value: string }>;
  sections: MethodologyDescriptionSection[];
};

const worldAroundMeDescriptionContent: MethodologyDescriptionContent = {
  methodologySlug: "world-around-me",
  lead:
    "我周围的世界 / Мир вокруг меня — практико-ориентированный курс китайского языка для детей 5–6 лет. Уроки строятся как живой сценарий: песня, видео, речевые модели, движение, работа с материалами и спокойное закрепление.",
  introParagraphs: [
    "Курс рассчитан на мягкий старт без перегруза: ребёнок сначала слышит, видит и проживает язык в действии, а затем начинает уверенно использовать знакомые фразы в мини-диалогах.",
    "Каждый урок — это 45 минут с чередованием активных и спокойных этапов. Такой ритм помогает удерживать внимание дошкольников и поддерживает дисциплину в группе.",
  ],
  passportFacts: [
    { label: "Возраст", value: "5–6 лет" },
    { label: "Длительность урока", value: "45 минут" },
    { label: "Песни", value: "21" },
    { label: "Видео", value: "21 (по 1 на урок)" },
    { label: "Словарь курса", value: "около 180 слов" },
    { label: "Размер группы", value: "4–6 детей, максимум 8" },
  ],
  sections: [
    {
      type: "fact_cards",
      id: "course-dna",
      title: "DNA курса",
      cards: [
        {
          title: "Как дети учатся",
          description:
            "Через короткие повторяющиеся паттерны, наглядность и ролевые игровые ситуации.",
          icon: "book",
        },
        {
          title: "Роль песен и видео",
          description:
            "Песня открывает и завершает цикл, а видео задаёт живой языковой контекст урока.",
          icon: "video",
        },
        {
          title: "Движение и TPR",
          description:
            "Команды, жест и перемещение помогают быстро закреплять лексику и глаголы действия.",
          icon: "sparkles",
        },
        {
          title: "Персонажи курса",
          description:
            "Сяо Лон (любознательный мальчик) и Сяо Мей (его подруга) сопровождают детей в речевых сценках.",
          icon: "users",
        },
      ],
    },
    {
      type: "grouped_bullets",
      id: "how-to-work",
      title: "Как работать с методикой",
      groups: [
        {
          title: "Что содержит план урока",
          items: [
            "Новые слова, фразы и речевые паттерны преподавателя.",
            "Пошаговые активности, реквизит, вопросы и ожидаемые ответы детей.",
            "Опоры для перехода от пассивного слушания к активному говорению.",
          ],
        },
        {
          title: "Подготовка к занятию",
          items: [
            "Заранее подготовьте карточки, игрушки, указку, рабочую тетрадь и приложение к уроку.",
            "Разложите реквизит по зонам класса, чтобы переходы между этапами были быстрыми.",
            "Проверьте аудио/видео до урока, чтобы не терять темп группы.",
          ],
        },
        {
          title: "Почему важно чередование",
          items: [
            "После активного этапа нужен спокойный этап закрепления (и наоборот).",
            "Так дети не устают от однотипной нагрузки и сохраняют включённость.",
            "Полный цикл урока формирует устойчивые речевые привычки, а не разрозненные слова.",
          ],
        },
      ],
    },
    {
      type: "anatomy_flow",
      id: "lesson-anatomy",
      title: "Анатомия урока (инфографика цикла)",
      stages: [
        {
          title: "1. Greeting song",
          description: "Ритуал входа: приветствие детей и героев курса, настрой на китайскую речь.",
          timeHint: "3–5 мин",
        },
        {
          title: "2. Видео + новая лексика",
          description: "Короткий видеосюжет, затем введение слов и фраз по визуальным опорам.",
          timeHint: "8–10 мин",
        },
        {
          title: "3. Guided practice",
          description: "Повторы по образцу, вопросы преподавателя, мини-диалоги в кругу.",
          timeHint: "8–10 мин",
        },
        {
          title: "4. Movement",
          description: "Команды, реакция всем телом, игры на скорость распознавания слова.",
          timeHint: "8–10 мин",
        },
        {
          title: "5. Workbook / manipulatives",
          description: "Спокойная отработка в тетради, с игрушками и приложениями.",
          timeHint: "8–10 мин",
        },
        {
          title: "6. Closing song",
          description: "Рекап ключевых слов и фраз, песня и ритуал завершения урока.",
          timeHint: "3–5 мин",
        },
      ],
    },
    {
      type: "bullets",
      id: "pedagogical-principles",
      title: "Педагогические принципы",
      items: [
        "Коммуникативный фокус: язык сразу используется в обращении, вопросе и ответе.",
        "Игровой формат: правило «учимся через действие, а не через объяснение».",
        "Мультисенсорность: слух + зрение + движение + предметные опоры.",
        "Повторяемость без скуки: одни и те же модели в разных мини-сюжетах.",
        "Пассивное и активное усвоение: сначала узнаём и понимаем, затем проговариваем.",
      ],
    },
    {
      type: "grouped_bullets",
      id: "learning-outcomes",
      title: "Ожидаемые результаты",
      groups: [
        {
          title: "Слушание и понимание",
          items: [
            "Ребёнок распознаёт знакомые слова и команды в речи преподавателя.",
            "Понимает контекст короткой песни, рифмовки или видеофрагмента.",
          ],
        },
        {
          title: "Говорение",
          items: [
            "Строит короткие ответы по моделям (например, 我是…, 这是…).",
            "Называет предметы и действия в пределах изученной темы.",
          ],
        },
        {
          title: "Поведение в классе и командность",
          items: [
            "Следует инструкции, соблюдает очередность и правила совместной игры.",
            "Работает в паре и мини-группе без потери учебного ритма.",
          ],
        },
        {
          title: "Мотивация и культурный горизонт",
          items: [
            "Сохраняет интерес к китайскому языку через сюжеты и персонажей.",
            "Получает первичный опыт уважительного знакомства с культурой Китая.",
          ],
        },
      ],
    },
    {
      type: "numbered_list",
      id: "thematic-map",
      title: "Тематическая карта курса",
      items: [
        "Модули 1–4: знакомство, окружающий мир, природа, предпочтения ребёнка.",
        "Модули 5–8: ежедневные действия, транспорт, животные, музыка и море.",
        "Модули 9–10: труд, профессии, творческие проекты и итоговое талант-шоу.",
      ],
    },
    {
      type: "fact_cards",
      id: "materials-ecosystem",
      title: "Экосистема материалов",
      cards: [
        {
          title: "Карточки",
          description: "Лексика урока: слова, фразы, иллюстрации и быстрые игровые повторы.",
          icon: "book",
        },
        {
          title: "Рабочая тетрадь",
          description: "Спокойное закрепление после активных этапов и проверка понимания.",
          icon: "clock",
        },
        {
          title: "Приложения и реквизит",
          description: "Указка, палочки, игрушки и предметные опоры для действий в классе.",
          icon: "users",
        },
        {
          title: "Песни и видео",
          description: "Ритм урока, эмоциональный якорь и естественное повторение лексики.",
          icon: "music",
        },
      ],
    },
    {
      type: "rich_text",
      id: "safety-note",
      title: "Важная заметка по безопасности",
      paragraphs: [
        "Перед запуском новой группы обязательно уточните у родителей пищевые аллергии детей.",
        "В ряде уроков используются продукты питания; подготовка безопасной альтернативы должна быть предусмотрена заранее.",
      ],
    },
  ],
};

const methodologyDescriptionContentBySlug: Record<
  string,
  MethodologyDescriptionContent
> = {
  "world-around-me": worldAroundMeDescriptionContent,
};

export function getMethodologyDescriptionContent(
  methodologySlug: string,
): MethodologyDescriptionContent | null {
  return methodologyDescriptionContentBySlug[methodologySlug] ?? null;
}
