import {
  BookOpenText,
  ChevronDown,
  Languages,
  NotebookPen,
  Package,
  Timer,
  Workflow,
} from "lucide-react";
import { useState } from "react";
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

type LessonPlanDisplayStep = {
  id: string;
  order: number;
  category: "Видео" | "Лексика" | "Активность" | "Счёт" | "Тетрадь" | "Песня" | "Завершение";
  title: string;
  text: string;
  glossaryTerms: string[];
  durationMinutes?: number;
  resourceIds?: string[];
  resourceButtons?: Array<{ label: string; assetId: string; preferDownload?: boolean }>;
};

const chineseGlossary: Record<string, string> = {
  "狗": "собака",
  "猫": "кошка",
  "兔子": "кролик",
  "马": "лошадь",
  "农场": "ферма",
  "我是…": "я…",
  "你是谁？": "кто ты?",
  "这是狗。": "это собака",
  "这是猫。": "это кошка",
  "这是兔子。": "это кролик",
  "这是马。": "это лошадь",
  "这是什么？": "что это?",
  "跑": "бежать",
  "跳": "прыгать",
  "我们跑吧！": "побегаем / давайте побегаем",
  "我们跳吧！": "попрыгаем / давайте попрыгаем",
  "跑到狗！": "беги к собаке",
  "跳到兔子！": "прыгай к кролику",
  "跑到马！": "беги к лошади",
  "跳到猫！": "прыгай к кошке",
  "狗在做什么？": "что собачка делает?",
  "狗在跳": "собачка прыгает",
  "在…里": "в / внутри",
  "猫住在农场里。": "кошка живёт на ферме",
};

const lessonOneDisplaySteps: LessonPlanDisplayStep[] = [
  {
    id: "lesson-1-step-1",
    order: 1,
    category: "Видео",
    title: "Смотрим видео «farm animals»",
    text: "Смотрим видео «farm animals».",
    glossaryTerms: [],
    durationMinutes: 3,
    resourceIds: ["video:farm-animals"],
    resourceButtons: [
      { label: "Предпросмотр видео", assetId: "video:farm-animals" },
      { label: "Скачать MP4", assetId: "video:farm-animals", preferDownload: true },
    ],
  },
  {
    id: "lesson-1-step-2",
    order: 2,
    category: "Лексика",
    title: "Учим фразу 我是…",
    text: "Учим фразу 我是… (я…). Садимся в круг, по очереди представляемся, указывая на себя и героев: 我是… (имя преподавателя/героя). По очереди спрашиваем детей: 你是谁？ (Кто ты?) и помогаем с ответом: 我是…",
    glossaryTerms: ["我是…", "你是谁？"],
    durationMinutes: 3,
  },
  {
    id: "lesson-1-step-3",
    order: 3,
    category: "Лексика",
    title: "Учим слова 狗，猫，兔子，马",
    text: "Учим слова 狗 (собака)，猫 (кошка)，兔子 (кролик)，马 (лошадь) с помощью карточек. Показываем их детям поочередно два раза. Первый раз называем только слово, соответствующее картинке: 狗，猫，兔子，马. Второй раз проговариваем предложением: 这是狗。 这是猫。 这是兔子。 这是马。",
    glossaryTerms: ["狗", "猫", "兔子", "马", "这是狗。", "这是猫。", "这是兔子。", "这是马。"],
    durationMinutes: 4,
    resourceIds: ["flashcards:world-around-me-lesson-1"],
    resourceButtons: [
      { label: "Предпросмотр карточек", assetId: "flashcards:world-around-me-lesson-1" },
      { label: "Скачать PDF", assetId: "flashcards:world-around-me-lesson-1", preferDownload: true },
    ],
  },
  {
    id: "lesson-1-step-4",
    order: 4,
    category: "Активность",
    title: "Изображаем животных",
    text: "Встаем. Поочередно указываем на карточки с животными и изображаем их вместе с детьми: лаем, как собаки, приглаживаем усики, как коты и т.д. Комментируем действия: 我是狗.",
    glossaryTerms: ["我是狗。"],
    durationMinutes: 3,
  },
  {
    id: "lesson-1-step-5",
    order: 5,
    category: "Активность",
    title: "Игра с мячом у стены",
    text: "С помощью малярного скотча расклеиваем карточки с животными на стене и берем мяч. Задача ребенка: попасть мячом по той карточке, которую называет преподаватель, и сказать, что на ней изображено.",
    glossaryTerms: [],
    durationMinutes: 4,
  },
  {
    id: "lesson-1-step-6",
    order: 6,
    category: "Счёт",
    title: "Счётные палочки",
    text: "Садимся. Берем палочки для счета, показательно считаем до 5. Раздаем палочки каждому ребенку и считаем все вместе.",
    glossaryTerms: [],
    durationMinutes: 3,
  },
  {
    id: "lesson-1-step-7",
    order: 7,
    category: "Счёт",
    title: "Приложение 1: указываем, считаем и называем животных",
    text: "Приложение 1: раздаем каждому ребенку картинки из приложения 1 и указку. Вместе указываем, считаем и называем животных.",
    glossaryTerms: ["狗", "猫", "兔子", "马"],
    durationMinutes: 4,
    resourceIds: ["worksheet:appendix-1"],
    resourceButtons: [
      { label: "Предпросмотр Приложения 1", assetId: "worksheet:appendix-1" },
      { label: "Скачать PDF", assetId: "worksheet:appendix-1", preferDownload: true },
    ],
  },
  {
    id: "lesson-1-step-8",
    order: 8,
    category: "Активность",
    title: "Учим глаголы 跑，跳",
    text: "Встаем. Учим глаголы 跑 (бежать)，跳 (прыгать). Даем команду: 我们跑吧！ (Побегаем!) 我们跳吧！ (Попрыгаем!) и выполняем вместе с детьми.",
    glossaryTerms: ["跑", "跳", "我们跑吧！", "我们跳吧！"],
    durationMinutes: 3,
  },
  {
    id: "lesson-1-step-9",
    order: 9,
    category: "Активность",
    title: "Команды с мягкими игрушками",
    text: "Берем мягкие игрушки собаки, кота, кролика и лошади и расставляем по комнате. Даем команды: 跑到狗！ 跳到兔子！ 跑到马！ 跳到猫！",
    glossaryTerms: ["跑到狗！", "跳到兔子！", "跑到马！", "跳到猫！"],
    durationMinutes: 4,
  },
  {
    id: "lesson-1-step-10",
    order: 10,
    category: "Активность",
    title: "Отрабатываем 跑，跳 на мягких игрушках",
    text: "Берем мягкие игрушки и отрабатываем на них глаголы 跑 (бежать)，跳 (прыгать). Попутно задаем вопросы: 狗在做什么？ (Что собачка делает?) 狗在跳 (Собачка прыгает) и т.д.",
    glossaryTerms: ["跑", "跳", "狗在做什么？", "狗在跳"],
    durationMinutes: 3,
  },
  {
    id: "lesson-1-step-11",
    order: 11,
    category: "Тетрадь",
    title: "Рабочая тетрадь, страницы 3–4",
    text: "Выполняем страницы 3–4 в рабочей тетради. Раскрашиваем животных, задавая вопрос 这是什么？ (Что это?)",
    glossaryTerms: ["这是什么？"],
    durationMinutes: 4,
    resourceIds: ["worksheet:workbook-pages-3-4"],
    resourceButtons: [
      { label: "Предпросмотр тетради", assetId: "worksheet:workbook-pages-3-4" },
      { label: "Скачать PDF", assetId: "worksheet:workbook-pages-3-4", preferDownload: true },
    ],
  },
  {
    id: "lesson-1-step-12",
    order: 12,
    category: "Лексика",
    title: "Учим слово 农场",
    text: "Учим слово 农场 (ферма) с помощью карточки.",
    glossaryTerms: ["农场"],
    durationMinutes: 2,
  },
  {
    id: "lesson-1-step-13",
    order: 13,
    category: "Активность",
    title: "Игрушечная ферма и конструкция 在…里",
    text: "Отрабатываем слова 农场，狗，猫，兔子，马 и грамматическую конструкцию 在…里 при помощи игрушечной фермы. Ставим игрушки на ферму и комментируем: 猫住在农场里。 (Кошка живёт на ферме)",
    glossaryTerms: ["农场", "狗", "猫", "兔子", "马", "在…里", "猫住在农场里。"],
    durationMinutes: 4,
  },
  {
    id: "lesson-1-step-14",
    order: 14,
    category: "Песня",
    title: "Поём песню «Животные на ферме»",
    text: "Поем песню «Животные на ферме».",
    glossaryTerms: [],
    durationMinutes: 3,
    resourceIds: ["song:farm-animals", "song-video:farm-animals-movement"],
    resourceButtons: [
      { label: "Воспроизвести аудио", assetId: "song:farm-animals" },
      { label: "Скачать аудио", assetId: "song:farm-animals", preferDownload: true },
      { label: "Видео с движениями", assetId: "song-video:farm-animals-movement" },
    ],
  },
  {
    id: "lesson-1-step-15",
    order: 15,
    category: "Завершение",
    title: "Прощаемся с детьми и героями курса",
    text: "Прощаемся с детьми и героями курса.",
    glossaryTerms: [],
    durationMinutes: 2,
  },
];

function isLessonOnePlan(steps: MethodologyLessonStep[]) {
  return steps.length === 15 && steps[0]?.title.includes("farm animals");
}

function ResourceButtons({
  actions,
  assetsById,
}: {
  actions: NonNullable<LessonPlanDisplayStep["resourceButtons"]>;
  assetsById: Record<string, ReusableAsset>;
}) {
  const resolved = actions
    .map((action) => ({ action, asset: assetsById[action.assetId] }))
    .filter((item) => Boolean(item.asset));
  if (!resolved.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {resolved.map(({ action, asset }) => {
        if (!asset) return null;
        const href = action.preferDownload
          ? asset.fileRef ?? asset.sourceUrl
          : asset.sourceUrl ?? asset.fileRef;
        if (!href) return null;
        return (
          <a
            key={`${action.assetId}-${action.label}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800"
          >
            {action.label}
          </a>
        );
      })}
    </div>
  );
}

function GlossaryChips({ terms, compactTop = false }: { terms: string[]; compactTop?: boolean }) {
  if (!terms.length) return null;
  return (
    <div className={`${compactTop ? "mt-1" : "mt-3"} flex flex-wrap gap-1.5`}>
      {terms.map((term) => (
        <span
          key={term}
          title={chineseGlossary[term] ?? ""}
          className="inline-flex rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-900"
          style={{ fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif' }}
        >
          {term}
        </span>
      ))}
    </div>
  );
}

function CollapsibleCard({
  title,
  defaultOpen = true,
  icon: Icon,
  contentClassName,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Icon className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          {title}
        </h3>
        <ChevronDown
          className={`h-4 w-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className={`border-t border-neutral-100 px-4 py-3 ${contentClassName ?? ""}`}>
          {children}
        </div>
      ) : null}
    </article>
  );
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

  return (
    <section className="space-y-6" aria-label="План урока">
      <section className="space-y-3">
        <CollapsibleCard title="Об уроке" icon={BookOpenText} defaultOpen>
          <p className="text-sm text-neutral-700">
            Первый урок знакомит детей с животными фермы через видео, карточки, движение, счёт, игрушечную ферму и песню. План следует методике: учитель ведёт детей от первых слов к коротким моделям 我是… / 这是… / 在…里.
          </p>
        </CollapsibleCard>

        {lessonNotesSlot ? (
          <CollapsibleCard
            title="Заметки к уроку"
            icon={NotebookPen}
            defaultOpen
            contentClassName="pt-1"
          >
            {lessonNotesSlot}
          </CollapsibleCard>
        ) : null}

        <CollapsibleCard
          title="Новые слова и фразы"
          icon={Languages}
          defaultOpen
          contentClassName="pt-1"
        >
          <GlossaryChips compactTop terms={["狗", "猫", "兔子", "马", "农场", "我是…", "这是狗。", "跑", "跳", "我们跑吧！", "在…里"]} />
        </CollapsibleCard>

        <CollapsibleCard title="Реквизиты к уроку" icon={Package} defaultOpen={false}>
          <ul className="space-y-1 text-sm text-neutral-700">
            <li>Активность 1: герои курса</li>
            <li>Активность 3: герои курса</li>
            <li>Активность 4: карточки 狗，猫，兔子，马</li>
            <li>Активность 6: малярный скотч, карточки 狗，猫，兔子，马, мяч</li>
            <li>Активность 7: палочки для счета</li>
            <li>Активность 8: приложение 1, указка</li>
            <li>Активность 10: мягкие игрушки (собака, кот, кролик, лошадь)</li>
            <li>Активность 11: мягкие игрушки (собака, кот, кролик, лошадь)</li>
            <li>Активность 12: рабочая тетрадь</li>
            <li>Активность 13: карточка 农场</li>
            <li>Активность 14: игрушечная ферма</li>
            <li>Активность 16: герои курса</li>
          </ul>
        </CollapsibleCard>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-neutral-950">Структура урока</h2>
          <Chip tone="sky" icon={Timer} className="whitespace-nowrap">45 минут</Chip>
          <Chip tone="neutral" icon={Workflow} className="whitespace-nowrap">15 шагов</Chip>
        </div>

        <div className="space-y-3">
          {lessonOneDisplaySteps.map((step) => (
            <article key={step.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" tone="inverse">Шаг {step.order}</Chip>
                  <Chip size="sm" tone="neutral">{step.category}</Chip>
                  <Chip
                    size="sm"
                    tone="sky"
                    icon={Timer}
                    className="whitespace-nowrap"
                  >
                    {step.durationMinutes ?? steps.find((sourceStep) => sourceStep.order === step.order)?.durationMinutes ?? 3} мин
                  </Chip>
                </div>
                {onShowOnStudentScreen ? (
                  <button
                    type="button"
                    onClick={() => {
                      const sourceStep = steps.find((source) => source.order === step.order);
                      if (sourceStep) onShowOnStudentScreen(sourceStep.id);
                    }}
                    className={productButtonClassName("secondary", "text-sm whitespace-nowrap")}
                  >
                    <BookOpenText className="h-4 w-4" aria-hidden="true" />
                    На экран
                  </button>
                ) : null}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-neutral-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{step.text}</p>
              <GlossaryChips terms={step.glossaryTerms} />
              {step.resourceButtons ? (
                <ResourceButtons actions={step.resourceButtons} assetsById={assetsById} />
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function GenericPlan({ quickSummary, steps, durationLabel }: Pick<Props, "quickSummary" | "steps" | "durationLabel">) {
  return (
    <section className="space-y-6" aria-label="План урока">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold text-neutral-950">Кратко об уроке</h2>
        <p className="mt-2 text-sm text-neutral-700">{durationLabel ?? "45 минут"} · {steps.length} шагов</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickSummary.keyWords.map((word) => <Chip key={word} tone="sky">{word}</Chip>)}
          {quickSummary.keyPhrases.map((phrase) => <Chip key={phrase} tone="violet">{phrase}</Chip>)}
        </div>
      </section>
      <section className="space-y-3">
        {steps.map((step) => (
          <article key={step.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h3 className="text-base font-semibold text-neutral-950">Шаг {step.order}. {step.title}</h3>
            {step.teacher.description ? <p className="mt-2 text-sm text-neutral-700">{step.teacher.description}</p> : null}
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
