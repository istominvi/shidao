import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Languages,
  Maximize,
  MonitorUp,
  Package,
  Presentation,
  Timer,
  Workflow,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { ReusableAsset } from "@/lib/lesson-content";
import type { MethodologyLessonStep } from "@/lib/server/methodology-lesson-unified-read-model";

type Props = {
  quickSummary: {
    prepChecklist: string[];
    keyWords: string[];
    keyPhrases: string[];
  };
  steps: MethodologyLessonStep[];
  durationLabel?: string | null;
  summaryNote?: string | null;
  activeStudentStepId?: string | null;
  assetsById?: Record<string, ReusableAsset>;
  lessonNotesSlot?: ReactNode;
  onShowOnStudentScreen?: (stepId: string) => void;
  onOpenStudentScreen?: (stepId: string) => void;
};

type GlossaryTermData = {
  term: string;
  meaning: string;
  pinyin?: string;
};

type LessonPlanDisplayStep = {
  id: string;
  order: number;
  phaseLabel: string;
  modeLabel: "спокойно" | "подвижно" | "за столом" | "смешанный" | "песня";
  durationMinutes: number;
  title: string;
  sourceTitleNeedle: string;
  teacherGoal: string;
  teacherActions: string[];
  teacherScript: GlossaryTermData[];
  studentActions: string;
  expectedResponses: string;
  successCriteria: string;
  materials: string[];
  glossaryTerms: GlossaryTermData[];
  resourceIds?: string[];
};

const cjkFontFamily =
  '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Arial Unicode MS", system-ui, sans-serif';

const lessonPromise =
  "Первый урок знакомит детей с животными фермы через видео, карточки, движение, счёт, игрушечную ферму и песню. Учитель ведёт детей от отдельных слов к коротким моделям: 我是… / 这是… / 我们…吧！ / 在…里.";

const activeVocabulary: GlossaryTermData[] = [
  { term: "狗", meaning: "собака", pinyin: "gǒu" },
  { term: "猫", meaning: "кошка", pinyin: "māo" },
  { term: "兔子", meaning: "кролик", pinyin: "tùzi" },
  { term: "马", meaning: "лошадь", pinyin: "mǎ" },
  { term: "农场", meaning: "ферма", pinyin: "nóngchǎng" },
  { term: "跑", meaning: "бежать", pinyin: "pǎo" },
  { term: "跳", meaning: "прыгать", pinyin: "tiào" },
];

const speechPatterns: GlossaryTermData[] = [
  { term: "你是谁？", meaning: "Кто ты?", pinyin: "nǐ shì shéi?" },
  { term: "我是…", meaning: "Я…", pinyin: "wǒ shì…" },
  { term: "这是…", meaning: "Это…", pinyin: "zhè shì…" },
  { term: "我们…吧！", meaning: "Давайте…", pinyin: "wǒmen…ba!" },
  { term: "在…里", meaning: "в / внутри", pinyin: "zài…lǐ" },
];

const lessonOneDisplaySteps: LessonPlanDisplayStep[] = [
  {
    id: "lesson-1-step-1",
    order: 1,
    phaseLabel: "Вход в тему",
    modeLabel: "спокойно",
    durationMinutes: 3,
    title: "Смотрим видео «farm animals»",
    sourceTitleNeedle: "farm animals",
    teacherGoal: "Создать первое аудио-визуальное знакомство с животными фермы.",
    teacherActions: [
      "Включите видео полностью, без длинных объяснений перед просмотром.",
      "При необходимости коротко ставьте паузу, чтобы акцентировать знакомый образ или звук.",
    ],
    teacherScript: [],
    studentActions: "Смотрят, слушают, соотносят звук и изображение.",
    expectedResponses: "Узнают знакомые образы животных, пытаются повторить слова и звуки.",
    successCriteria: "Минимум 2 животных распознаны по картинке или звуку.",
    materials: ["Видео: farm animals"],
    glossaryTerms: [
      { term: "狗", meaning: "собака" },
      { term: "猫", meaning: "кошка" },
      { term: "兔子", meaning: "кролик" },
      { term: "马", meaning: "лошадь" },
    ],
    resourceIds: ["video:farm-animals"],
  },
  {
    id: "lesson-1-step-2",
    order: 2,
    phaseLabel: "Речевая модель",
    modeLabel: "спокойно",
    durationMinutes: 3,
    title: "Учим фразу 我是…",
    sourceTitleNeedle: "我是",
    teacherGoal: "Ввести первую личную модель высказывания.",
    teacherActions: [
      "Посадите детей в круг и покажите на себя/героя курса.",
      "По очереди задавайте вопрос каждому ребёнку с поддержкой ответа.",
    ],
    teacherScript: [
      { term: "你是谁？", meaning: "Кто ты?" },
      { term: "我是…", meaning: "Я…" },
    ],
    studentActions: "Отвечают по модели с подсказкой учителя.",
    expectedResponses: "Короткий ответ «我是…» с именем/ролью.",
    successCriteria: "Большинство детей пробуют модель «我是…» вслух.",
    materials: ["Герои курса для ритуала знакомства"],
    glossaryTerms: [{ term: "我是…", meaning: "Я…" }, { term: "你是谁？", meaning: "Кто ты?" }],
  },
  {
    id: "lesson-1-step-3",
    order: 3,
    phaseLabel: "Лексика",
    modeLabel: "смешанный",
    durationMinutes: 4,
    title: "Учим слова 狗，猫，兔子，马 с карточками",
    sourceTitleNeedle: "狗",
    teacherGoal: "Связать карточку, слово и короткую фразу «这是…».",
    teacherActions: [
      "Первый проход: называйте только слово по карточке.",
      "Второй проход: переходите к фразе «这是…».",
    ],
    teacherScript: [
      { term: "狗", meaning: "собака" },
      { term: "猫", meaning: "кошка" },
      { term: "兔子", meaning: "кролик" },
      { term: "马", meaning: "лошадь" },
      { term: "这是狗。", meaning: "Это собака." },
      { term: "这是猫。", meaning: "Это кошка." },
      { term: "这是兔子。", meaning: "Это кролик." },
      { term: "这是马。", meaning: "Это лошадь." },
    ],
    studentActions: "Смотрят на карточки, повторяют слова и фразы за учителем.",
    expectedResponses: "Называют животных по карточке, затем в модели «这是…».",
    successCriteria: "Дети уверенно соотносят 4 карточки с нужными словами.",
    materials: ["Карточки lesson 1", "Ферма-карточка входит в этот же PDF"],
    glossaryTerms: [
      { term: "狗", meaning: "собака" },
      { term: "猫", meaning: "кошка" },
      { term: "兔子", meaning: "кролик" },
      { term: "马", meaning: "лошадь" },
      { term: "这是…", meaning: "Это…" },
    ],
    resourceIds: ["flashcards:world-around-me-lesson-1"],
  },
  {
    id: "lesson-1-step-4",
    order: 4,
    phaseLabel: "Телесное закрепление",
    modeLabel: "подвижно",
    durationMinutes: 3,
    title: "Изображаем животных",
    sourceTitleNeedle: "Изображаем",
    teacherGoal: "Соединить слово с движением и образом тела.",
    teacherActions: [
      "Поднимите детей, показывайте карточку — дети изображают животное.",
      "Комментируйте действие короткими моделями.",
    ],
    teacherScript: [
      { term: "我是狗。", meaning: "Я собака." },
      { term: "我是猫。", meaning: "Я кошка." },
    ],
    studentActions: "Изображают животных телом и голосом.",
    expectedResponses: "Повторяют модель «我是…» во время движения.",
    successCriteria: "Слово вызывает правильное движение без долгих подсказок.",
    materials: ["Карточки животных"],
    glossaryTerms: [{ term: "我是…", meaning: "Я…" }],
  },
  {
    id: "lesson-1-step-5",
    order: 5,
    phaseLabel: "Игра на распознавание",
    modeLabel: "подвижно",
    durationMinutes: 4,
    title: "Игра с мячом у стены",
    sourceTitleNeedle: "мяч",
    teacherGoal: "Проверить быстрое распознавание и активный recall слов.",
    teacherActions: [
      "Закрепите карточки на стене на уровне детей.",
      "Называйте животное; ребёнок бросает мяч в нужную карточку и проговаривает ответ.",
    ],
    teacherScript: [{ term: "这是什么？", meaning: "Что это?" }, { term: "这是…", meaning: "Это…" }],
    studentActions: "Слушают слово, целятся в карточку, называют животное.",
    expectedResponses: "Быстрая реакция и короткий устный ответ.",
    successCriteria: "Большинство попаданий и ответов соответствуют названному животному.",
    materials: ["Мяч", "Малярный скотч", "Карточки животных"],
    glossaryTerms: [{ term: "这是什么？", meaning: "Что это?" }, { term: "这是…", meaning: "Это…" }],
  },
  {
    id: "lesson-1-step-6",
    order: 6,
    phaseLabel: "Переход к спокойной работе",
    modeLabel: "за столом",
    durationMinutes: 3,
    title: "Счётные палочки",
    sourceTitleNeedle: "Счётные",
    teacherGoal: "Ввести счёт 1–5 через предметное действие.",
    teacherActions: [
      "Покажите счёт до 5 на палочках в общем темпе.",
      "Раздайте палочки детям и повторите счёт вместе.",
      "Не вводите сложные классификаторы на этом уроке.",
    ],
    teacherScript: [],
    studentActions: "Считают палочки за учителем и самостоятельно.",
    expectedResponses: "Ритмично считают до пяти в общей группе.",
    successCriteria: "Каждый ребёнок проходит счёт 1–5 с предметной опорой.",
    materials: ["Счётные палочки"],
    glossaryTerms: [],
  },
  {
    id: "lesson-1-step-7",
    order: 7,
    phaseLabel: "Спокойное закрепление",
    modeLabel: "за столом",
    durationMinutes: 4,
    title: "Приложение 1: указываем, считаем и называем",
    sourceTitleNeedle: "Приложение 1",
    teacherGoal: "Стабилизировать лексику после движения в спокойном формате.",
    teacherActions: [
      "Раздайте Приложение 1 и указки.",
      "Ведите группу по циклу: покажи → посчитай → назови.",
    ],
    teacherScript: [
      { term: "狗", meaning: "собака" },
      { term: "猫", meaning: "кошка" },
      { term: "兔子", meaning: "кролик" },
      { term: "马", meaning: "лошадь" },
    ],
    studentActions: "Указывают, считают и называют животных.",
    expectedResponses: "Устойчивое называние животных в спокойном темпе.",
    successCriteria: "Дети без спешки называют животных и не теряют фокус.",
    materials: ["Worksheet: Appendix 1", "Указки"],
    glossaryTerms: [
      { term: "狗", meaning: "собака" },
      { term: "猫", meaning: "кошка" },
      { term: "兔子", meaning: "кролик" },
      { term: "马", meaning: "лошадь" },
    ],
    resourceIds: ["worksheet:appendix-1"],
  },
  {
    id: "lesson-1-step-8",
    order: 8,
    phaseLabel: "Глаголы действия",
    modeLabel: "подвижно",
    durationMinutes: 3,
    title: "Учим глаголы 跑，跳",
    sourceTitleNeedle: "глаголы",
    teacherGoal: "Ввести действия «бежать/прыгать» в командной модели.",
    teacherActions: [
      "Дайте чёткую команду и покажите действие корпусом.",
      "Сделайте 2–3 коротких цикла смены команды.",
    ],
    teacherScript: [
      { term: "我们跑吧！", meaning: "Давайте побежим!" },
      { term: "我们跳吧！", meaning: "Давайте попрыгаем!" },
    ],
    studentActions: "Выполняют команды всей группой.",
    expectedResponses: "Различают и выполняют 跑 / 跳 по голосовой инструкции.",
    successCriteria: "Команда запускает правильное движение у большинства детей.",
    materials: ["Свободное пространство в классе"],
    glossaryTerms: [
      { term: "跑", meaning: "бежать" },
      { term: "跳", meaning: "прыгать" },
      { term: "我们…吧！", meaning: "Давайте…" },
    ],
  },
  {
    id: "lesson-1-step-9",
    order: 9,
    phaseLabel: "Командная игра",
    modeLabel: "подвижно",
    durationMinutes: 4,
    title: "Команды с мягкими игрушками",
    sourceTitleNeedle: "мягкими игрушками",
    teacherGoal: "Закрепить понимание глагола + цель движения.",
    teacherActions: [
      "Разместите игрушки по комнате (собака/кошка/кролик/лошадь).",
      "Давайте команды в бодром темпе, следите за безопасностью движения.",
    ],
    teacherScript: [
      { term: "跑到狗！", meaning: "Беги к собаке!" },
      { term: "跳到兔子！", meaning: "Прыгай к кролику!" },
      { term: "跑到马！", meaning: "Беги к лошади!" },
      { term: "跳到猫！", meaning: "Прыгай к кошке!" },
    ],
    studentActions: "Двигаются к нужной игрушке и выполняют действие.",
    expectedResponses: "Корректно различают run/jump и целевое животное.",
    successCriteria: "Нет путаницы в командах: 跑 = бежать, 跳 = прыгать.",
    materials: ["Мягкие игрушки: собака, кошка, кролик, лошадь"],
    glossaryTerms: [
      { term: "跑到狗！", meaning: "Беги к собаке!" },
      { term: "跳到兔子！", meaning: "Прыгай к кролику!" },
      { term: "跑到马！", meaning: "Беги к лошади!" },
      { term: "跳到猫！", meaning: "Прыгай к кошке!" },
    ],
  },
  {
    id: "lesson-1-step-10",
    order: 10,
    phaseLabel: "Речь по наблюдению",
    modeLabel: "смешанный",
    durationMinutes: 3,
    title: "Отрабатываем 跑，跳 на мягких игрушках",
    sourceTitleNeedle: "Отрабатываем",
    teacherGoal: "Перейти от команды к короткому описанию действия.",
    teacherActions: [
      "Двигайте игрушку и задавайте вопрос про действие.",
      "Моделируйте ответ и приглашайте детей повторить/достроить.",
    ],
    teacherScript: [
      { term: "狗在做什么？", meaning: "Что делает собака?" },
      { term: "狗在跳。", meaning: "Собака прыгает." },
      { term: "猫在跑。", meaning: "Кошка бежит." },
    ],
    studentActions: "Наблюдают, отвечают короткой фразой по модели.",
    expectedResponses: "Дают ответ с глаголом действия.",
    successCriteria: "Дети используют шаблон «X在跑/跳» с опорой.",
    materials: ["Мягкие игрушки животных"],
    glossaryTerms: [
      { term: "狗在做什么？", meaning: "Что делает собака?" },
      { term: "狗在跳。", meaning: "Собака прыгает." },
      { term: "猫在跑。", meaning: "Кошка бежит." },
    ],
  },
  {
    id: "lesson-1-step-11",
    order: 11,
    phaseLabel: "Работа в тетради",
    modeLabel: "за столом",
    durationMinutes: 4,
    title: "Рабочая тетрадь, страницы 3–4",
    sourceTitleNeedle: "страницы 3",
    teacherGoal: "Перенести лексику в спокойную продуктивную деятельность.",
    teacherActions: [
      "Откройте страницы 3–4 и задайте короткий темп раскрашивания.",
      "Ходите между столами и задавайте вопрос по картинке.",
    ],
    teacherScript: [
      { term: "这是什么？", meaning: "Что это?" },
      { term: "这是…", meaning: "Это…" },
    ],
    studentActions: "Раскрашивают животных, отвечают устно на вопрос учителя.",
    expectedResponses: "Называют животное через «这是…».",
    successCriteria: "У каждого ребёнка есть минимум 1–2 устных ответа по картинке.",
    materials: ["Workbook pages 3–4", "Карандаши"],
    glossaryTerms: [{ term: "这是什么？", meaning: "Что это?" }, { term: "这是…", meaning: "Это…" }],
    resourceIds: ["worksheet:workbook-pages-3-4"],
  },
  {
    id: "lesson-1-step-12",
    order: 12,
    phaseLabel: "Лексика темы места",
    modeLabel: "спокойно",
    durationMinutes: 2,
    title: "Учим слово 农场",
    sourceTitleNeedle: "农场",
    teacherGoal: "Ввести ключевое место темы урока — ферма.",
    teacherActions: [
      "Покажите карточку фермы из общего набора карточек.",
      "Повторите слово и простую модель 这是农场.",
    ],
    teacherScript: [
      { term: "农场", meaning: "ферма" },
      { term: "这是农场。", meaning: "Это ферма." },
    ],
    studentActions: "Повторяют слово и фразу хором и по очереди.",
    expectedResponses: "Связывают изображение фермы с новым словом.",
    successCriteria: "Слово 农场 узнаётся без дополнительной подсказки.",
    materials: ["Карточка фермы (в PDF карточек lesson 1)"],
    glossaryTerms: [{ term: "农场", meaning: "ферма" }, { term: "这是农场。", meaning: "Это ферма." }],
  },
  {
    id: "lesson-1-step-13",
    order: 13,
    phaseLabel: "Модель места",
    modeLabel: "смешанный",
    durationMinutes: 4,
    title: "Игрушечная ферма и 在…里",
    sourceTitleNeedle: "Игрушечная ферма",
    teacherGoal: "Связать животных с местом через модель 在…里.",
    teacherActions: [
      "Расположите животных на/в ферме и проговаривайте модель.",
      "Разрешайте простые версии ответа для детей этого возраста.",
    ],
    teacherScript: [
      { term: "猫住在农场里。", meaning: "Кошка живёт на ферме." },
      { term: "狗在农场里。", meaning: "Собака на ферме." },
      { term: "马在农场里。", meaning: "Лошадь на ферме." },
    ],
    studentActions: "Переставляют фигурки и комментируют по образцу.",
    expectedResponses: "Используют конструкцию 在…里 в короткой фразе.",
    successCriteria: "Дети связывают минимум 1 животное с фразой про место.",
    materials: ["Игрушечная ферма", "Фигурки животных"],
    glossaryTerms: [
      { term: "在…里", meaning: "в / внутри" },
      { term: "猫住在农场里。", meaning: "Кошка живёт на ферме." },
      { term: "狗在农场里。", meaning: "Собака на ферме." },
    ],
  },
  {
    id: "lesson-1-step-14",
    order: 14,
    phaseLabel: "Музыкальное закрепление",
    modeLabel: "песня",
    durationMinutes: 3,
    title: "Песня «farm animals»",
    sourceTitleNeedle: "Песня",
    teacherGoal: "Эмоционально закрепить лексику через музыку и ритм.",
    teacherActions: [
      "Включите аудио песни и подпевайте с детьми.",
      "При необходимости используйте movement-видео как подсказку учителю.",
    ],
    teacherScript: [],
    studentActions: "Поют/слушают, подключают знакомые движения.",
    expectedResponses: "Радостно повторяют знакомые слова из темы.",
    successCriteria: "Группа удерживает участие до конца трека.",
    materials: ["Аудио песни", "Видео движений для учителя"],
    glossaryTerms: [
      { term: "狗", meaning: "собака" },
      { term: "猫", meaning: "кошка" },
      { term: "兔子", meaning: "кролик" },
      { term: "马", meaning: "лошадь" },
    ],
    resourceIds: ["song:farm-animals", "song-video:farm-animals-movement"],
  },
  {
    id: "lesson-1-step-15",
    order: 15,
    phaseLabel: "Финал",
    modeLabel: "спокойно",
    durationMinutes: 2,
    title: "Прощаемся с детьми и героями курса",
    sourceTitleNeedle: "Прощаемся",
    teacherGoal: "Завершить урок позитивно и снять результат каждого ребёнка.",
    teacherActions: [
      "Сделайте короткий круг-рекап: каждый ребёнок называет 1 животное или действие.",
      "Попрощайтесь от лица героев курса и похвалите группу.",
    ],
    teacherScript: [
      { term: "狗", meaning: "собака" },
      { term: "跑", meaning: "бежать" },
    ],
    studentActions: "Называют одно слово/действие и участвуют в прощальном ритуале.",
    expectedResponses: "Есть личный маленький успех у каждого ребёнка.",
    successCriteria: "Каждый ребёнок смог вспомнить минимум 1 единицу материала.",
    materials: ["Герои курса"],
    glossaryTerms: [
      { term: "狗", meaning: "собака" },
      { term: "猫", meaning: "кошка" },
      { term: "跑", meaning: "бежать" },
      { term: "跳", meaning: "прыгать" },
    ],
  },
];

function isLessonOnePlan(steps: MethodologyLessonStep[]) {
  const firstTitle = steps[0]?.title.toLowerCase() ?? "";
  return steps.length >= 15 && firstTitle.includes("farm animals");
}

function mapAssetUrls(asset: ReusableAsset) {
  const metadata = asset.metadata ?? {};
  const localUrl =
    typeof asset.fileRef === "string" && asset.fileRef.startsWith("/methodologies/")
      ? asset.fileRef
      : undefined;
  const previewImageRefs = [
    ...(Array.isArray(metadata.previewImageRefs) ? metadata.previewImageRefs : []),
    ...(typeof metadata.previewImageRef === "string" ? [metadata.previewImageRef] : []),
  ].filter((value): value is string => typeof value === "string");
  const slideImageRefs = Array.isArray(metadata.slideImageRefs)
    ? metadata.slideImageRefs.filter((value): value is string => typeof value === "string")
    : [];
  const cardImageRefs = Array.isArray(metadata.cardImageRefs)
    ? metadata.cardImageRefs.filter((value): value is string => typeof value === "string")
    : [];
  const pptxFileRef = typeof metadata.pptxFileRef === "string" ? metadata.pptxFileRef : undefined;
  const fallbackUrl = !localUrl ? asset.sourceUrl : undefined;
  return { localUrl, fallbackUrl, previewImageRefs, slideImageRefs, cardImageRefs, pptxFileRef };
}

function StepAssetVideoCarousel({ assets }: { assets: ReusableAsset[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedAssets = assets.filter((asset) => {
    const { localUrl, fallbackUrl } = mapAssetUrls(asset);
    return Boolean(localUrl ?? fallbackUrl);
  });
  if (!normalizedAssets.length) return null;

  const activeAsset = normalizedAssets[activeIndex] ?? normalizedAssets[0];
  const { localUrl, fallbackUrl } = mapAssetUrls(activeAsset);
  const activeUrl = localUrl ?? fallbackUrl;
  if (!activeUrl) return null;

  return (
    <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3">
      <video
        controls
        playsInline
        preload="metadata"
        src={activeUrl}
        className="w-full rounded-lg border border-sky-100 bg-black"
      />
      {normalizedAssets.length > 1 ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              setActiveIndex((prev) => (prev === 0 ? normalizedAssets.length - 1 : prev - 1))
            }
            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Назад
          </button>
          <span className="text-xs text-neutral-600">
            Видео {activeIndex + 1} из {normalizedAssets.length}
          </span>
          <button
            type="button"
            onClick={() => setActiveIndex((prev) => (prev + 1) % normalizedAssets.length)}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-800"
          >
            Вперёд
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={activeUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800"
        >
          Открыть видео
        </a>
        {localUrl ? (
          <a
            href={localUrl}
            download
            className="inline-flex rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800"
          >
            Скачать MP4
          </a>
        ) : null}
      </div>
    </div>
  );
}

function downloadLabel(asset: ReusableAsset) {
  if (asset.kind === "song_audio" || asset.kind === "song" || asset.kind === "pronunciation_audio") {
    return "Скачать аудио";
  }
  if (asset.kind === "song_video" || asset.kind === "video" || asset.kind === "lesson_video") {
    return "Скачать MP4";
  }
  if (
    asset.kind === "presentation" ||
    asset.kind === "flashcards_pdf" ||
    asset.kind === "worksheet" ||
    asset.kind === "worksheet_pdf"
  ) {
    return "Скачать PDF";
  }
  return "Скачать файл";
}

function openLabel(asset: ReusableAsset) {
  if (asset.kind === "song_audio" || asset.kind === "song" || asset.kind === "pronunciation_audio") {
    return "Открыть аудио";
  }
  if (asset.kind === "song_video" || asset.kind === "video" || asset.kind === "lesson_video") {
    return "Открыть видео";
  }
  if (
    asset.kind === "presentation" ||
    asset.kind === "flashcards_pdf" ||
    asset.kind === "worksheet" ||
    asset.kind === "worksheet_pdf"
  ) {
    return "Открыть PDF";
  }
  return "Открыть файл";
}

function LessonPlanResourcePreview({
  asset,
  mode = "default",
}: {
  asset: ReusableAsset;
  mode?: "default" | "single-slide";
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeCard, setActiveCard] = useState(0);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const { localUrl, fallbackUrl, previewImageRefs, slideImageRefs, cardImageRefs, pptxFileRef } =
    mapAssetUrls(asset);
  const primaryUrl = localUrl ?? fallbackUrl;
  if (!primaryUrl && !previewImageRefs.length && !slideImageRefs.length && !cardImageRefs.length) {
    return null;
  }

  const actionButtonClassName =
    "inline-flex rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800";

  if (asset.kind === "video" || asset.kind === "lesson_video" || asset.kind === "song_video") {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {primaryUrl ? (
          <video
            controls
            playsInline
            preload="metadata"
            src={primaryUrl}
            className="w-full rounded-lg border border-neutral-200 bg-black"
          />
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {primaryUrl ? (
            <a href={primaryUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              {openLabel(asset)}
            </a>
          ) : null}
          {localUrl ? (
            <a href={localUrl} download className={actionButtonClassName}>
              {downloadLabel(asset)}
            </a>
          ) : null}
          {!localUrl && fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть источник
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "song_audio" || asset.kind === "song" || asset.kind === "pronunciation_audio") {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {primaryUrl ? <audio controls preload="metadata" src={primaryUrl} className="w-full" /> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {!localUrl && fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть аудио
            </a>
          ) : null}
          {localUrl ? (
            <a href={localUrl} download className={actionButtonClassName}>
              Скачать аудио
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "presentation") {
    const previewSlides = slideImageRefs.length ? slideImageRefs : localUrl ? [localUrl] : [];
    const currentSlide = previewSlides[activeSlide] ?? previewSlides[0];

    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {mode === "single-slide" && currentSlide ? (
          <div ref={frameRef} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {slideImageRefs.length ? (
              <img
                src={currentSlide}
                alt={`Слайд ${activeSlide + 1}: ${asset.title}`}
                className="h-64 w-full object-contain"
              />
            ) : (
              <iframe src={currentSlide} title={asset.title} className="h-64 w-full bg-white" />
            )}
          </div>
        ) : slideImageRefs.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slideImageRefs.slice(0, 6).map((imageRef, index) => (
              <img
                key={imageRef}
                src={imageRef}
                alt={`Слайд ${index + 1}: ${asset.title}`}
                className="h-20 w-full rounded-md border border-neutral-200 object-cover"
              />
            ))}
          </div>
        ) : localUrl ? (
          <iframe src={localUrl} title={asset.title} className="h-56 w-full rounded-lg border border-neutral-200 bg-white" />
        ) : null}
        {mode === "single-slide" && previewSlides.length > 1 ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveSlide((prev) => (prev === 0 ? previewSlides.length - 1 : prev - 1))}
              className={actionButtonClassName}
            >
              <ChevronLeft className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              Назад
            </button>
            <span className="text-xs text-neutral-600">
              Слайд {activeSlide + 1} из {previewSlides.length}
            </span>
            <button
              type="button"
              onClick={() => setActiveSlide((prev) => (prev + 1) % previewSlides.length)}
              className={actionButtonClassName}
            >
              Вперёд
              <ChevronRight className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {mode === "single-slide" ? (
            <button
              type="button"
              onClick={() => frameRef.current?.requestFullscreen?.()}
              className={actionButtonClassName}
            >
              <Maximize className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              На весь экран
            </button>
          ) : null}
          {localUrl ? (
            <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть PDF
            </a>
          ) : null}
          {pptxFileRef ? (
            <a href={pptxFileRef} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Скачать PPTX
            </a>
          ) : null}
          {!localUrl && fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть источник
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "flashcards_pdf") {
    const currentCard = cardImageRefs[activeCard] ?? cardImageRefs[0];
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {mode === "single-slide" && currentCard ? (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <img
              src={currentCard}
              alt={`Карточка ${activeCard + 1}: ${asset.title}`}
              className="h-64 w-full object-contain"
            />
          </div>
        ) : cardImageRefs.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {cardImageRefs.slice(0, 10).map((imageRef, index) => (
              <img
                key={imageRef}
                src={imageRef}
                alt={`Карточка ${index + 1}: ${asset.title}`}
                className="h-20 w-full rounded-md border border-neutral-200 object-cover"
              />
            ))}
          </div>
        ) : null}
        {mode === "single-slide" && cardImageRefs.length > 1 ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveCard((prev) => (prev === 0 ? cardImageRefs.length - 1 : prev - 1))}
              className={actionButtonClassName}
            >
              <ChevronLeft className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              Назад
            </button>
            <span className="text-xs text-neutral-600">
              Карточка {activeCard + 1} из {cardImageRefs.length}
            </span>
            <button
              type="button"
              onClick={() => setActiveCard((prev) => (prev + 1) % cardImageRefs.length)}
              className={actionButtonClassName}
            >
              Вперёд
              <ChevronRight className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {localUrl ? (
            <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть PDF
            </a>
          ) : null}
          {localUrl ? (
            <a href={localUrl} download className={actionButtonClassName}>
              Скачать PDF
            </a>
          ) : null}
          {!localUrl && fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть источник
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (asset.kind === "worksheet" || asset.kind === "worksheet_pdf") {
    return (
      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        {previewImageRefs.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {previewImageRefs.slice(0, 2).map((imageRef, index) => (
              <img
                key={imageRef}
                src={imageRef}
                alt={`Превью листа ${index + 1}: ${asset.title}`}
                className="h-40 w-full rounded-md border border-neutral-200 object-cover"
              />
            ))}
          </div>
        ) : localUrl ? (
          <iframe src={localUrl} title={asset.title} className="h-56 w-full rounded-lg border border-neutral-200 bg-white" />
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {localUrl ? (
            <a href={localUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть PDF
            </a>
          ) : null}
          {localUrl ? (
            <a href={localUrl} download className={actionButtonClassName}>
              Скачать PDF
            </a>
          ) : null}
          {!localUrl && fallbackUrl ? (
            <a href={fallbackUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
              Открыть источник
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="mt-2 flex flex-wrap gap-2">
        {primaryUrl ? (
          <a href={primaryUrl} target="_blank" rel="noreferrer" className={actionButtonClassName}>
            {openLabel(asset)}
          </a>
        ) : null}
        {localUrl ? (
          <a href={localUrl} download className={actionButtonClassName}>
            {downloadLabel(asset)}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function GlossaryTerm({ item }: { item: GlossaryTermData }) {
  return (
    <span
      title={`${item.meaning}${item.pinyin ? ` · ${item.pinyin}` : ""}`}
      className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-900"
      style={{ fontFamily: cjkFontFamily }}
    >
      {item.term}
    </span>
  );
}

function GlossaryRow({ terms }: { terms: GlossaryTermData[] }) {
  if (!terms.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {terms.map((term) => (
        <GlossaryTerm key={`${term.term}-${term.meaning}`} item={term} />
      ))}
    </div>
  );
}

function modeBadgeClassName(mode: LessonPlanDisplayStep["modeLabel"]) {
  switch (mode) {
    case "подвижно":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "за столом":
      return "border-violet-200 bg-violet-50 text-violet-800";
    case "смешанный":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "песня":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "спокойно":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function PreparationPanel({ assetsById }: { assetsById: Record<string, ReusableAsset> }) {
  const prepGroups = [
    {
      title: "Персонажи и ритуал",
      description:
        "Короткий ритуал старта до первого шага: приветствие с героями курса, настрой на тему и правила движения.",
      items: ["Герои курса", "Короткое приветствие и улыбка-ритуал"],
      icon: Package,
    },
    {
      title: "Карточки и PDF",
      description: "Проверьте доступ к карточкам и презентации до начала урока.",
      items: ["Карточки lesson 1", "Презентация lesson 1", "Карточка 农场 внутри PDF карточек"],
      resourceIds: ["flashcards:world-around-me-lesson-1", "presentation:world-around-me-lesson-1"],
      icon: FileText,
    },
    {
      title: "Реквизит для движения",
      description: "Подготовьте класс для активных этапов заранее.",
      items: ["Мяч", "Малярный скотч", "Мягкие игрушки: 狗 / 猫 / 兔子 / 马"],
      icon: Workflow,
    },
    {
      title: "Тетрадь и приложение",
      description: "Разложите материалы для спокойных столовых этапов.",
      items: ["Worksheet Appendix 1", "Workbook страницы 3–4", "Указки", "Счётные палочки"],
      resourceIds: ["worksheet:appendix-1", "worksheet:workbook-pages-3-4"],
      icon: FileText,
    },
    {
      title: "Медиа и песня",
      description: "Проверьте звук и готовность к финальному музыкальному блоку.",
      items: ["Видео farm animals", "Песня farm animals", "Movement video для учителя"],
      resourceIds: ["video:farm-animals", "song:farm-animals", "song-video:farm-animals-movement"],
      icon: Presentation,
    },
  ];

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-neutral-950">До урока подготовить</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {prepGroups.map((group) => {
          const Icon = group.icon;
          return (
            <article key={group.title} className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <Icon className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                {group.title}
              </h3>
              <p className="mt-1 text-sm text-neutral-600">{group.description}</p>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                {group.items.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              {group.resourceIds?.map((resourceId) => {
                const asset = assetsById[resourceId];
                if (!asset) return null;
                const previewMode = resourceId.includes("presentation") || resourceId.includes("flashcards");
                return (
                  <LessonPlanResourcePreview
                    key={`${group.title}-${resourceId}`}
                    asset={asset}
                    mode={previewMode ? "single-slide" : "default"}
                  />
                );
              })}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function resolveStepIdByNeedle(step: LessonPlanDisplayStep, sourceSteps: MethodologyLessonStep[]) {
  const needle = step.sourceTitleNeedle.toLowerCase();
  const byNeedle = sourceSteps.find((sourceStep) => sourceStep.title.toLowerCase().includes(needle));
  if (byNeedle) return byNeedle.id;
  return sourceSteps.find((sourceStep) => sourceStep.order === step.order)?.id;
}

function LessonOnePlan({
  assetsById,
  lessonNotesSlot,
  steps,
  onShowOnStudentScreen,
}: {
  assetsById: Record<string, ReusableAsset>;
  lessonNotesSlot?: ReactNode;
  steps: MethodologyLessonStep[];
  onShowOnStudentScreen?: (stepId: string) => void;
}) {
  const totalMinutes = useMemo(
    () => lessonOneDisplaySteps.reduce((accumulator, step) => accumulator + step.durationMinutes, 0),
    [],
  );

  return (
    <section className="space-y-5" aria-label="План урока">
      <section className="rounded-3xl border border-neutral-200 bg-gradient-to-br from-white to-slate-50 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="inverse">План урока</Chip>
          <Chip tone="sky" icon={Timer}>
            {totalMinutes} минут
          </Chip>
          <Chip tone="neutral" icon={Workflow}>
            15 активностей
          </Chip>
          <Chip tone="violet">5–6 лет</Chip>
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-neutral-950">Урок 1. Животные на ферме</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-700" style={{ fontFamily: cjkFontFamily }}>
          {lessonPromise}
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Languages className="h-4 w-4" aria-hidden="true" />
              Активная лексика
            </h2>
            <GlossaryRow terms={activeVocabulary} />
          </article>
          <article className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-sky-900">
              <Languages className="h-4 w-4" aria-hidden="true" />
              Речевые модели
            </h2>
            <GlossaryRow terms={speechPatterns} />
          </article>
        </div>
      </section>

      <PreparationPanel assetsById={assetsById} />

      {lessonNotesSlot ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Заметки к уроку</h2>
          <div className="mt-2">{lessonNotesSlot}</div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-950">Ход урока</h2>
          <Chip tone="sky" icon={Timer}>
            45 минут
          </Chip>
          <Chip tone="neutral" icon={Workflow}>
            15 шагов
          </Chip>
        </div>

        <div className="space-y-3">
          {lessonOneDisplaySteps.map((step) => {
            const sourceStepId = resolveStepIdByNeedle(step, steps);
            return (
              <article key={step.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-neutral-800">
                      Шаг {step.order}
                    </span>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-800">
                      {step.phaseLabel}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 ${modeBadgeClassName(step.modeLabel)}`}>
                      {step.modeLabel}
                    </span>
                    <span className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-neutral-700">
                      {step.durationMinutes} мин
                    </span>
                  </div>
                  {onShowOnStudentScreen && sourceStepId ? (
                    <button
                      type="button"
                      onClick={() => onShowOnStudentScreen(sourceStepId)}
                      className={productButtonClassName("secondary", "text-sm whitespace-nowrap")}
                    >
                      <MonitorUp className="h-4 w-4" aria-hidden="true" />
                      На экран
                    </button>
                  ) : null}
                </div>

                <h3 className="mt-3 text-xl font-semibold text-neutral-950" style={{ fontFamily: cjkFontFamily }}>
                  {step.title}
                </h3>

                <div className="mt-3 grid gap-3 text-sm text-neutral-700 lg:grid-cols-2">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <p className="font-semibold text-neutral-900">Педагогическая цель</p>
                    <p className="mt-1">{step.teacherGoal}</p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <p className="font-semibold text-neutral-900">Ожидаемый результат</p>
                    <p className="mt-1">{step.expectedResponses}</p>
                    <p className="mt-1 text-xs text-neutral-600">Критерий успеха: {step.successCriteria}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 text-sm text-neutral-700 lg:grid-cols-3">
                  <div className="rounded-xl border border-neutral-200 p-3">
                    <p className="font-semibold text-neutral-900">Что делает учитель</p>
                    <ul className="mt-1 space-y-1">
                      {step.teacherActions.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-neutral-200 p-3" style={{ fontFamily: cjkFontFamily }}>
                    <p className="font-semibold text-neutral-900">Что говорит учитель</p>
                    {step.teacherScript.length ? (
                      <ul className="mt-1 space-y-1">
                        {step.teacherScript.map((line) => (
                          <li key={`${line.term}-${line.meaning}`} title={line.meaning}>
                            • {line.term}
                            <span className="ml-2 text-xs text-neutral-500">— {line.meaning}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-neutral-500">Короткие комментарии по ситуации, без перегруза.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-neutral-200 p-3">
                    <p className="font-semibold text-neutral-900">Что делают дети</p>
                    <p className="mt-1">{step.studentActions}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-sm font-semibold text-neutral-900">Материалы шага</p>
                  <ul className="mt-1 text-sm text-neutral-700">
                    {step.materials.map((material) => (
                      <li key={material}>• {material}</li>
                    ))}
                  </ul>
                  <GlossaryRow terms={step.glossaryTerms} />
                </div>

                {step.resourceIds?.map((resourceId) => {
                  const asset = assetsById[resourceId];
                  if (!asset) return null;
                  if (step.order === 1 && resourceId === "video:farm-animals") {
                    const stepOneAssets = [
                      asset,
                      assetsById["video-clip:farm-animals-dog"],
                      assetsById["video-clip:farm-animals-cat"],
                      assetsById["video-clip:farm-animals-rabbit"],
                      assetsById["video-clip:farm-animals-horse"],
                    ].filter((item): item is ReusableAsset => Boolean(item));
                    return <StepAssetVideoCarousel key={`${step.id}-${resourceId}`} assets={stepOneAssets} />;
                  }
                  return <LessonPlanResourcePreview key={`${step.id}-${resourceId}`} asset={asset} />;
                })}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function GenericPlan({
  quickSummary,
  steps,
  durationLabel,
}: Pick<Props, "quickSummary" | "steps" | "durationLabel">) {
  return (
    <section className="space-y-6" aria-label="План урока">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold text-neutral-950">Кратко об уроке</h2>
        <p className="mt-2 text-sm text-neutral-700">
          {durationLabel ?? "45 минут"} · {steps.length} шагов
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickSummary.keyWords.map((word) => (
            <Chip key={word} tone="sky">
              {word}
            </Chip>
          ))}
          {quickSummary.keyPhrases.map((phrase) => (
            <Chip key={phrase} tone="violet">
              {phrase}
            </Chip>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        {steps.map((step) => (
          <article key={step.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h3 className="text-base font-semibold text-neutral-950">
              Шаг {step.order}. {step.title}
            </h3>
            {step.teacher.description ? (
              <p className="mt-2 text-sm text-neutral-700">{step.teacher.description}</p>
            ) : null}
          </article>
        ))}
      </section>
    </section>
  );
}

export function TeacherLessonPedagogicalContent({
  quickSummary,
  steps,
  durationLabel,
  assetsById = {},
  lessonNotesSlot,
  onShowOnStudentScreen,
}: Props) {
  if (isLessonOnePlan(steps)) {
    return (
      <LessonOnePlan
        assetsById={assetsById}
        lessonNotesSlot={lessonNotesSlot}
        steps={steps}
        onShowOnStudentScreen={onShowOnStudentScreen}
      />
    );
  }

  return <GenericPlan quickSummary={quickSummary} steps={steps} durationLabel={durationLabel} />;
}
