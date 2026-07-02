import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Archive,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  ClipboardCheck,
  Clock3,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  FolderTree,
  GraduationCap,
  Laptop,
  Layers,
  MonitorPlay,
  Package,
  School,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Инструкция для методистов",
  description:
    "Как подготовить методику для переноса в ShiDao: структура папок, паспорт программы, уроки, шаги, материалы и домашние задания.",
  robots: {
    index: false,
    follow: false,
  },
};

const navItems = [
  { href: "#principle", label: "Главный принцип" },
  { href: "#structure", label: "Папки" },
  { href: "#methodology-files", label: "Содержание" },
  { href: "#lesson", label: "Урок" },
  { href: "#step", label: "Шаг" },
] as const;

const heroSummaryItems = [
  {
    icon: FileImage,
    text: "Методика начинается с этикетки и описания методики.",
  },
  {
    icon: Laptop,
    text: "У каждого урока есть онлайн-План Урока.",
  },
  {
    icon: School,
    text: "У каждого урока есть офлайн-План Урока с реквизитом.",
  },
  {
    icon: Layers,
    text: "Онлайн- и офлайн-планы совпадают по номерам и названиям шагов.",
  },
  {
    icon: MonitorPlay,
    text: "Экран ученика нужен и онлайн, и офлайн для показа группе.",
  },
  {
    icon: ClipboardList,
    text: "Домашнее задание хранится отдельно от планов урока.",
  },
] satisfies Array<{ icon: LucideIcon; text: string }>;

const lessonSurfaces = [
  {
    title: "Онлайн-План Урока",
    icon: Laptop,
    tone: "sky",
    text: "Приватная инструкция для преподавателя, который ведёт урок через звонок или онлайн-класс.",
    details: [
      "что говорит и делает преподаватель на каждом шаге",
      "что показать, включить, открыть или отправить ученикам",
      "ожидаемые ответы детей и подсказки для темпа урока",
    ],
  },
  {
    title: "Офлайн-План Урока",
    icon: School,
    tone: "amber",
    text: "Версия того же урока для класса, где часть цифровых действий заменяется физической работой.",
    details: [
      "какой реквизит, карточки, игрушки или распечатки нужны",
      "как посадить детей, что раздать и когда собрать обратно",
      "какие онлайн-действия заменить движением, игрой или предметами",
    ],
  },
  {
    title: "Экран ученика",
    icon: MonitorPlay,
    tone: "emerald",
    text: "То, что видят дети: общий экран для онлайн-урока и для показа на большом экране в офлайн-группе.",
    details: [
      "короткая инструкция для ученика без методических подсказок",
      "визуалы, аудио, видео, карточки или интерактив шага",
      "тот же номер и название шага, что в онлайн- и офлайн-Плане",
    ],
  },
  {
    title: "Домашнее задание",
    icon: ClipboardList,
    tone: "rose",
    text: "Отдельный блок после урока, который ученик или родитель получает уже вне занятия.",
    details: [
      "понятная инструкция простым языком",
      "материалы, ссылки и ориентир по времени",
      "формат ответа и критерии проверки, если они нужны",
    ],
  },
] satisfies Array<{
  title: string;
  icon: LucideIcon;
  tone: "sky" | "amber" | "emerald" | "rose";
  text: string;
  details: string[];
}>;

type FileStructureNode = {
  name: string;
  kind: "folder" | "file" | "image";
  hint?: string;
  children?: FileStructureNode[];
};

const fileStructure: FileStructureNode[] = [
  {
    name: "Методика «Мир вокруг меня»",
    kind: "folder",
    children: [
      {
        name: "Этикетка методики",
        kind: "image",
        hint: "квадратная PNG/JPEG-картинка, минимум 800×800",
      },
      {
        name: "Описание методики",
        kind: "file",
        hint: "один текстовый файл со всеми разделами методики",
      },
      {
        name: "Общие материалы для методики",
        kind: "folder",
        hint: "файлы для курса в целом, не для конкретного урока",
      },
      {
        name: "Уроки",
        kind: "folder",
        children: [
          {
            name: "01. Животные на ферме",
            kind: "folder",
            children: [
              { name: "Описание урока", kind: "file" },
              {
                name: "01. Приветствие и видео",
                kind: "folder",
                hint: "папка шага",
                children: [
                  {
                    name: "Описание шага",
                    kind: "file",
                    hint: "онлайн-План, офлайн-План, Экран ученика",
                  },
                  {
                    name: "Материалы",
                    kind: "folder",
                    hint: "файлы только для этого шага",
                  },
                ],
              },
              {
                name: "02. Карточки животных",
                kind: "folder",
                hint: "папка шага",
                children: [
                  {
                    name: "Описание шага",
                    kind: "file",
                    hint: "онлайн-План, офлайн-План, Экран ученика",
                  },
                  {
                    name: "Материалы",
                    kind: "folder",
                    hint: "файлы только для этого шага",
                  },
                ],
              },
              {
                name: "Домашнее задание",
                kind: "file",
                hint: "инструкция, материалы, формат ответа",
              },
            ],
          },
        ],
      },
    ],
  },
];

const lessonDescriptionSections = [
  {
    title: "Название и место в курсе",
    icon: FileText,
    text: "Название урока, модуль, номер урока, примерная длительность и статус готовности. Пример: «Урок 1. Животные на ферме», модуль 1, урок 1, 45 минут, готово.",
  },
  {
    title: "Цель и результат урока",
    icon: CheckCircle2,
    text: "Что урок должен дать ребёнку: какие слова он узнает, какие фразы попробует, какое действие сможет выполнить к концу занятия.",
  },
  {
    title: "Ключевые слова и фразы",
    icon: BookOpenCheck,
    text: "Список лексики, фраз и моделей урока. Для китайского указывайте иероглифы, pinyin, перевод и короткий комментарий, если слово вводится через игру или жест.",
  },
  {
    title: "Материалы и реквизит",
    icon: Package,
    text: "Что понадобится для урока: видео, песни, презентации, рабочие листы, карточки, игрушки, распечатки, предметы для офлайн-группы. Если нужны копии, укажите количество.",
  },
  {
    title: "Особенности проведения",
    icon: ClipboardCheck,
    text: "Что важно учесть преподавателю: темп, переходы, сложные места, различия между онлайн- и офлайн-проведением, что обязательно показать на Экране ученика.",
  },
  {
    title: "Домашнее задание",
    icon: ClipboardList,
    text: "Кратко: название домашки, что делает ребёнок дома, какие материалы нужны, сколько времени занимает, какой формат ответа или проверки ожидается.",
  },
  {
    title: "Комментарии методиста",
    icon: ShieldAlert,
    text: "Любые важные заметки: безопасность, аллергии, подготовка класса, ограничения материалов, что можно упростить или чем заменить активность.",
  },
];

const stepChecklist = [
  "номер и название шага совпадают в онлайн-Плане, офлайн-Плане и на Экране ученика",
  "внутри шага есть файл «Описание шага»",
  "рядом лежит папка «Материалы» только для этого шага",
  "методические подсказки не копируются на Экран ученика",
];

const stepCards = [
  {
    icon: Laptop,
    title: "Онлайн-План Урока",
    text: "Что преподаватель делает в онлайн-формате: что говорит, открывает, включает, отправляет или демонстрирует.",
  },
  {
    icon: School,
    title: "Офлайн-План Урока",
    text: "Как тот же шаг провести в классе: реквизит, раздатка, движение, посадка, физические карточки и замены онлайн-действий.",
  },
  {
    icon: MonitorPlay,
    title: "Экран ученика",
    text: "Что видят дети: короткая инструкция, визуальная опора, аудио, видео, карточки или интерактив без приватных подсказок.",
  },
  {
    icon: Package,
    title: "Материалы шага",
    text: "Файлы, которые нужны именно здесь: презентация, аудио, видео, карточки, worksheet, распечатка или офлайн-реквизит.",
  },
] satisfies Array<{ icon: LucideIcon; title: string; text: string }>;

const stepDescriptionSections = [
  {
    title: "Номер, название и время",
    icon: Clock3,
    text: "Укажите номер шага, название и ориентир по времени. Пример: «Шаг 03. Карточки животных», 4 минуты.",
  },
  {
    title: "Онлайн-План Урока",
    icon: Laptop,
    text: "Что делает преподаватель онлайн, что показывает или включает, какие ответы ожидает и какие подсказки может использовать.",
  },
  {
    title: "Офлайн-План Урока",
    icon: School,
    text: "Что делает преподаватель в классе, что раздаёт, какой реквизит использует, что говорит и как адаптирует действие.",
  },
  {
    title: "Экран ученика",
    icon: MonitorPlay,
    text: "Коротко опишите, что должно быть на экране ученика и можно ли ученику нажимать, выбирать, слушать или отвечать.",
  },
  {
    title: "Материалы",
    icon: Package,
    text: "Перечислите файлы из папки «Материалы» и назначение каждого: показать, включить, распечатать, раздать или скачать.",
  },
  {
    title: "Подсказки и адаптации",
    icon: ClipboardCheck,
    text: "Добавьте важные методические комментарии: как упростить шаг, чем заменить материал, где дети могут застрять.",
  },
];

const coverRequirements = [
  "Квадрат: 1:1.",
  "Размер: минимум 800×800 пикселей, лучше 1024×1024.",
  "Формат: PNG или JPEG.",
  "На картинке видно название методики.",
  "Стиль подходит детям и теме курса.",
  "Без мелкого текста, который не читается в маленькой карточке.",
];

const methodologyDescriptionSections = [
  {
    title: "Название и краткое описание",
    icon: FileText,
    text: "Название методики на русском и языке курса. Пример: «Мир вокруг меня – 我周围的世界». Краткое описание: «Китайский для детей 5–6 лет, 45-минутные занятия с песнями, видео и активной игровой практикой».",
  },
  {
    title: "Короткие параметры",
    icon: Clock3,
    text: "Количество уроков, длительность курса, средняя длительность урока, возраст, уровень, размер группы, примерное количество активностей.",
  },
  {
    title: "Паспорт и ДНК программы",
    icon: BookOpenCheck,
    text: "Кому подходит курс, формат занятий, длительность, объём словаря и главная методическая логика: через что дети учатся, как устроено повторение, какую роль играют песни, видео, движение, герои курса или проекты.",
  },
  {
    title: "Как работать с методикой",
    icon: ClipboardCheck,
    text: "Пожелания методиста для преподавателя: как готовиться, что содержит План Урока, что важно не пропускать, как держать темп.",
  },
  {
    title: "Педагогические принципы",
    icon: GraduationCap,
    text: "Главные правила курса: коммуникативность, повторяемость, TPR, работа в малой группе, баланс активных и спокойных этапов.",
  },
  {
    title: "Ожидаемые результаты",
    icon: CheckCircle2,
    text: "Что ученик должен уметь после курса: понимать инструкции, отвечать фразами, использовать лексику, участвовать в играх и диалогах.",
  },
  {
    title: "Материалы и реквизиты",
    icon: Package,
    text: "Что используется в методике: песни, видео, картинки, карточки, рабочие листы, игрушки, продукты, кубики, маски, книги и другие предметы.",
  },
  {
    title: "Прочие заметки",
    icon: ShieldAlert,
    text: "Безопасность, аллергии, ограничения, важные авторские комментарии, особенности групп, печати или подготовки класса.",
  },
];

const lessonRules = [
  {
    icon: Layers,
    title: "Урок собирается из шагов",
    text: "В описании урока даётся короткая структура, а подробности каждого шага лежат в отдельной папке шага.",
  },
  {
    icon: Clock3,
    title: "Видна педагогическая рамка",
    text: "Методист указывает цель, длительность, лексику, фразы, результат урока и статус готовности.",
  },
  {
    icon: Package,
    title: "Материалы понятны заранее",
    text: "В уроке перечисляются видео, песни, презентации, рабочие листы, карточки и офлайн-реквизит для подготовки.",
  },
  {
    icon: ClipboardList,
    title: "Домашка описана отдельно",
    text: "В описании урока есть краткая сводка домашки, а полная инструкция лежит отдельным файлом внутри урока.",
  },
] satisfies Array<{ icon: LucideIcon; title: string; text: string }>;

const homeworkChecklist = [
  "домашнее задание лежит отдельным файлом внутри папки урока",
  "инструкция написана простым языком для ученика и родителя",
  "указаны материалы, время выполнения и формат ответа",
  "ключи или критерии проверки добавлены, если они нужны",
];

const homeworkCards = [
  {
    icon: ClipboardList,
    title: "Инструкция",
    text: "Что ребёнок делает дома: повторяет слова, слушает аудио, выполняет worksheet, записывает ответ или проходит квиз.",
  },
  {
    icon: Clock3,
    title: "Время",
    text: "Ориентир по длительности: например, 7-10 минут. Это помогает не перегружать домашку.",
  },
  {
    icon: Package,
    title: "Материалы",
    text: "Ссылки на карточки, аудио, видео, презентацию, распечатку или страницу рабочей тетради.",
  },
  {
    icon: CheckCircle2,
    title: "Проверка",
    text: "Формат ответа и критерии: фото, текст, устная практика, квиз, творческая работа или без отправки.",
  },
] satisfies Array<{ icon: LucideIcon; title: string; text: string }>;

const homeworkDescriptionSections = [
  {
    title: "Название домашнего задания",
    icon: FileText,
    text: "Короткое название, связанное с уроком. Пример: «Практика дома: ферма, слова и команды».",
  },
  {
    title: "Инструкция для ученика и родителя",
    icon: ClipboardList,
    text: "Опишите задание простым языком: что открыть, что повторить, что сделать и в каком порядке.",
  },
  {
    title: "Материалы",
    icon: Package,
    text: "Перечислите все нужные файлы и ссылки: рабочая тетрадь, карточки, аудио, видео, презентация, приложение.",
  },
  {
    title: "Формат ответа",
    icon: MonitorPlay,
    text: "Укажите, что должен отправить ученик: фото, текст, устный ответ, запись, квиз или ничего, если это только практика.",
  },
  {
    title: "Ориентир по времени",
    icon: Clock3,
    text: "Сколько примерно занимает задание. Если есть несколько частей, можно указать время для каждой.",
  },
  {
    title: "Ключи и критерии проверки",
    icon: CheckCircle2,
    text: "Если задание проверяется, добавьте правильные ответы, критерии или комментарии для преподавателя.",
  },
];

const materialCards = [
  {
    icon: Layers,
    title: "Материалы шага",
    text: "Файлы для конкретного шага лежат внутри папки этого шага и упоминаются в «Описании шага».",
  },
  {
    icon: FolderTree,
    title: "Общие материалы",
    text: "Файлы для всей методики лежат в корневой папке «Общие материалы для методики».",
  },
  {
    icon: School,
    title: "Офлайн-реквизит",
    text: "Предметы для класса описываются отдельно: что купить, распечатать, разрезать, раздать или подготовить.",
  },
  {
    icon: FileText,
    title: "Понятные названия",
    text: "Название файла должно объяснять урок, шаг и назначение: карточки, песня, видео, worksheet, презентация.",
  },
] satisfies Array<{ icon: LucideIcon; title: string; text: string }>;

const materialDescriptionSections = [
  {
    title: "Название и назначение",
    icon: FileText,
    text: "Назовите файл понятно и подпишите, зачем он нужен: для показа, печати, скачивания, аудирования или офлайн-игры.",
  },
  {
    title: "Где используется",
    icon: Layers,
    text: "Укажите урок и шаг. Если материал относится ко всей методике, положите его в общую папку и подпишите это.",
  },
  {
    title: "Формат файла",
    icon: Archive,
    text: "PDF, PPTX, PNG/JPEG, MP3, MP4, DOC/DOCX или другой формат. Для презентаций желательно приложить исходник и экспорт.",
  },
  {
    title: "Печать и подготовка",
    icon: School,
    text: "Для карточек, листов и реквизита укажите количество копий, размер, нужно ли разрезать, заламинировать или подготовить заранее.",
  },
  {
    title: "Видео и аудио",
    icon: MonitorPlay,
    text: "Укажите длительность, язык, нужный фрагмент и момент урока, где материал включается.",
  },
  {
    title: "Замены и ограничения",
    icon: ShieldAlert,
    text: "Если материал можно заменить, если есть безопасность, аллергии или ограничения по группе, напишите это рядом с материалом.",
  },
];

const materialRules = [
  "Называйте файлы понятно: lesson-01-step-03-animal-cards.pdf, lesson-01-song-farm.mp3.",
  "К каждому материалу добавляйте назначение: для показа, для скачивания, для печати, для преподавателя, для ученика, для офлайн-реквизита.",
  "Материалы конкретного шага кладите в папку «Материалы» внутри этого шага.",
  "Материалы для всей методики кладите в корневую папку «Общие материалы для методики».",
  "Для презентаций указывайте исходный файл и экспорт в PDF/картинки, если он есть.",
  "Для видео и аудио указывайте длительность, язык, где включать и нужен ли фрагмент, а не весь файл.",
  "Для карточек и рабочих листов указывайте, сколько копий печатать и на каком шаге использовать.",
  "Офлайн-реквизит перечисляйте отдельно: что купить, распечатать, разрезать, раздать или подготовить в классе.",
];

function IconBox({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-800 shadow-sm">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase text-teal-700">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black leading-tight text-neutral-950 md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-neutral-700 md:text-base">
        {description}
      </p>
    </div>
  );
}

function surfaceToneClass(tone: "sky" | "amber" | "emerald" | "rose") {
  if (tone === "sky") return "border-sky-200 bg-sky-50/80 text-sky-900";
  if (tone === "amber") return "border-amber-200 bg-amber-50/80 text-amber-900";
  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50/80 text-emerald-900";
  }
  return "border-rose-200 bg-rose-50/80 text-rose-900";
}

function surfaceIconToneClass(tone: "sky" | "amber" | "emerald" | "rose") {
  if (tone === "sky") return "border-sky-200 bg-white text-sky-700";
  if (tone === "amber") return "border-amber-200 bg-white text-amber-700";
  if (tone === "emerald") return "border-emerald-200 bg-white text-emerald-700";
  return "border-rose-200 bg-white text-rose-700";
}

function FileStructureTree({
  nodes,
  level = 0,
}: {
  nodes: FileStructureNode[];
  level?: number;
}) {
  return (
    <ul className={level === 0 ? "space-y-0.5" : "space-y-0.5"}>
      {nodes.map((node) => {
        const Icon =
          node.kind === "folder"
            ? Folder
            : node.kind === "image"
              ? FileImage
              : FileText;

        return (
          <li key={`${level}-${node.kind}-${node.name}`}>
            <div className="relative flex min-w-0 items-center gap-2 py-1.5">
              {level > 0 ? (
                <span
                  className="absolute -left-4 top-1/2 h-px w-3 bg-neutral-200"
                  aria-hidden="true"
                />
              ) : null}
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <Icon
                  className={
                    node.kind === "folder"
                      ? "h-4 w-4 text-amber-700"
                      : node.kind === "image"
                        ? "h-4 w-4 text-sky-700"
                        : "h-4 w-4 text-neutral-500"
                  }
                  aria-hidden="true"
                />
              </span>
              <p className="min-w-0 text-sm leading-6">
                <span className="font-semibold text-neutral-950">
                  {node.name}
                </span>
                {node.hint ? (
                  <span className="ml-2 text-xs text-neutral-500">
                    — {node.hint}
                  </span>
                ) : null}
              </p>
            </div>
            {node.children?.length ? (
              <div className="relative ml-2.5 pl-4">
                <span
                  className="absolute left-0 top-[-0.75rem] bottom-2 w-px bg-neutral-200"
                  aria-hidden="true"
                />
                <FileStructureTree nodes={node.children} level={level + 1} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function MethodologyGuidePage() {
  return (
    <main className="min-h-screen bg-[#f7f8fb] pb-16 text-neutral-950">
      <header className="border-b border-neutral-200 bg-white/95">
        <div className="container flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="text-xl font-black">
            Shidao
          </Link>
          <nav
            aria-label="Разделы инструкции"
            className="w-full min-w-0 overflow-x-auto md:w-auto"
          >
            <ul className="flex w-max gap-2 text-sm font-semibold text-neutral-700">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-flex min-h-9 items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 hover:bg-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-white">
        <div className="container grid gap-8 py-10 md:grid-cols-[1.15fr_0.85fr] md:items-start md:py-14">
          <div>
            <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
              Внутренняя инструкция для методистов
            </p>
            <h1 className="mt-5 max-w-4xl text-3xl font-black leading-tight md:text-5xl">
              Как подготовить методику, чтобы её можно было быстро и точно
              перенести в ShiDao
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-neutral-700 md:text-lg">
              Методика для сайта должна быть не набором файлов, а понятным
              педагогическим источником: описание курса, уроки, онлайн- и
              офлайн-Планы Урока, единые шаги, Экран ученика, материалы и
              домашнее задание.
            </p>
          </div>

          <aside className="rounded-lg border border-neutral-200 bg-[#f9fbf7] p-5">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <CheckCircle2
                className="h-5 w-5 text-emerald-700"
                aria-hidden="true"
              />
              Коротко
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
              {heroSummaryItems.map((item) => (
                <li key={item.text} className="flex gap-2.5">
                  <item.icon
                    className="mt-1 h-4 w-4 shrink-0 text-neutral-400"
                    aria-hidden="true"
                  />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section id="principle" className="container py-10 md:py-14">
        <SectionHeading
          eyebrow="01. Главный принцип"
          title="Один шаг связывает онлайн, офлайн и Экран ученика"
          description="В ShiDao урок строится как последовательность шагов. У каждого урока есть онлайн-План Урока, офлайн-План Урока, Экран ученика и Домашнее задание. Онлайн- и офлайн-планы могут отличаться действиями преподавателя, но совпадают по номерам и названиям шагов."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {lessonSurfaces.map((surface) => (
            <article
              key={surface.title}
              className={`rounded-lg border p-5 ${surfaceToneClass(surface.tone)}`}
            >
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${surfaceIconToneClass(surface.tone)}`}
              >
                <surface.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-base font-bold">{surface.title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-700">
                {surface.text}
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-5 text-neutral-700">
                {surface.details.map((detail) => (
                  <li key={detail} className="flex gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500"
                      aria-hidden="true"
                    />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section
        id="structure"
        className="border-y border-neutral-200 bg-white py-10 md:py-14"
      >
        <div className="container">
          <SectionHeading
            eyebrow="02. Структура папок"
            title="Стандартная файловая структура методики"
            description="В корне методики лежат только этикетка, один файл описания, общие материалы и папка уроков. Всё, что относится к конкретному уроку или шагу, уходит внутрь уроков."
          />
          <div className="mt-6 max-w-4xl rounded-lg border border-neutral-200 bg-[#fbfcff] p-4 md:p-5">
            <div className="mb-4 max-w-2xl text-sm leading-6 text-neutral-600">
              Названия можно слегка менять, но смысл должен сохраниться:
              этикетка-картинка, один файл описания методики, общие материалы и
              уроки по порядку.
            </div>
            <FileStructureTree nodes={fileStructure} />
          </div>
        </div>
      </section>

      <section id="methodology-files" className="container py-10 md:py-14">
        <SectionHeading
          eyebrow="03. Содержание методики"
          title="Содержание методики"
          description="Здесь описано, что должно быть внутри методики: этикетка, описание, общие материалы, уроки и шаги. Файловое дерево показано выше, а здесь — смысл каждого блока."
        />

        <div className="mt-6 space-y-4">
          <article className="rounded-lg border border-sky-200 bg-white p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <span className="text-5xl font-black leading-none text-sky-200">
                01
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <IconBox icon={FileImage} />
                  <h3 className="text-xl font-black">Этикетка методики</h3>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                  Картинка для карточки методики на сайте. Ориентир по стилю -
                  первая этикетка «Мир вокруг меня»: детская иллюстрация,
                  крупное название, понятная тема курса, без мелкого текста.
                </p>

                <div className="mt-5 grid gap-5 md:grid-cols-[160px_1fr]">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-sky-200 bg-sky-50">
                    <Image
                      src="/methodologies/01.png"
                      alt="Пример этикетки методики «Мир вокруг меня»"
                      fill
                      className="object-cover"
                      sizes="160px"
                    />
                  </div>
                  <ul className="grid content-start gap-2 text-sm leading-6 text-neutral-700 sm:grid-cols-2">
                    {coverRequirements.map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2
                          className="mt-1 h-4 w-4 shrink-0 text-sky-700"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-emerald-200 bg-white p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <span className="text-5xl font-black leading-none text-emerald-200">
                02
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <IconBox icon={FileText} />
                  <h3 className="text-xl font-black">
                    Файл «Описание методики»
                  </h3>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                  Один текстовый файл в формате .doc, .docx, .txt или .md.
                  Внутри идут разделы с понятными заголовками; оформление может
                  немного отличаться, но порядок и смысл лучше сохранить.
                </p>

                <div className="mt-5 border-l-2 border-emerald-300 pl-4">
                  <p className="text-sm font-bold text-emerald-950">
                    Сначала заполните краткий блок:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-neutral-700">
                    <li>Название: «Мир вокруг меня – 我周围的世界».</li>
                    <li>
                      Краткое описание: «Китайский для детей 5–6 лет,
                      45-минутные занятия с песнями, видео и активной игровой
                      практикой».
                    </li>
                    <li>
                      Количество уроков, длительность курса, средняя
                      длительность урока, возраст, уровень, размер группы,
                      количество активностей.
                    </li>
                  </ul>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-bold text-neutral-950">
                    Затем опишите разделы по порядку:
                  </p>
                  <ol className="mt-2 divide-y divide-neutral-200">
                    {methodologyDescriptionSections.map((item, index) => (
                      <li key={item.title} className="flex gap-4 py-3">
                        <span className="w-12 shrink-0 text-3xl font-black leading-none text-emerald-200">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <h4 className="flex items-center gap-2 text-sm font-bold text-neutral-950">
                            <item.icon
                              className="h-4 w-4 shrink-0 text-neutral-400"
                              aria-hidden="true"
                            />
                            {item.title}
                          </h4>
                          <p className="mt-1 text-sm leading-6 text-neutral-700">
                            {item.text}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-amber-200 bg-white p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <span className="text-5xl font-black leading-none text-amber-200">
                03
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <IconBox icon={FolderTree} />
                  <h3 className="text-xl font-black">
                    Общие материалы для методики
                  </h3>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                  Папка для файлов, которые относятся ко всей методике, а не к
                  одному уроку или шагу. Если материал нужен только в конкретном
                  шаге, он должен лежать внутри папки этого шага.
                </p>
                <ul className="mt-4 grid gap-2 text-sm leading-6 text-neutral-700 md:grid-cols-2">
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-1 h-4 w-4 shrink-0 text-amber-700"
                      aria-hidden="true"
                    />
                    <span>общие книги, справочники и правила работы</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-1 h-4 w-4 shrink-0 text-amber-700"
                      aria-hidden="true"
                    />
                    <span>большие комплекты распечаток и приложений</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-1 h-4 w-4 shrink-0 text-amber-700"
                      aria-hidden="true"
                    />
                    <span>общие таблицы слов, песен, видео или реквизита</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-1 h-4 w-4 shrink-0 text-amber-700"
                      aria-hidden="true"
                    />
                    <span>методические приложения не для отдельного урока</span>
                  </li>
                </ul>
              </div>
            </div>
          </article>

          <article
            id="lesson"
            className="rounded-lg border border-indigo-200 bg-white p-5 md:p-6"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <span className="text-5xl font-black leading-none text-indigo-200">
                04
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <IconBox icon={Folder} />
                  <h3 className="text-xl font-black">Уроки</h3>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                  Папка с уроками по порядку: 01, 02, 03. В каждом уроке лежит
                  краткое описание урока, папки шагов и домашнее задание.
                </p>
                <ul className="mt-4 grid gap-2 text-sm leading-6 text-neutral-700 md:grid-cols-2">
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-1 h-4 w-4 shrink-0 text-indigo-700"
                      aria-hidden="true"
                    />
                    <span>в папке урока есть файл «Описание урока»</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-1 h-4 w-4 shrink-0 text-indigo-700"
                      aria-hidden="true"
                    />
                    <span>каждый шаг оформлен отдельной папкой</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-1 h-4 w-4 shrink-0 text-indigo-700"
                      aria-hidden="true"
                    />
                    <span>
                      внутри шага есть «Описание шага» и папка «Материалы»
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2
                      className="mt-1 h-4 w-4 shrink-0 text-indigo-700"
                      aria-hidden="true"
                    />
                    <span>домашнее задание лежит отдельно внутри урока</span>
                  </li>
                </ul>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {lessonRules.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4"
                    >
                      <IconBox icon={item.icon} />
                      <h4 className="mt-3 text-sm font-bold text-indigo-950">
                        {item.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-neutral-700">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-lg border border-neutral-200 bg-[#fbfcff] p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <IconBox icon={FileText} />
                    <h4 className="text-lg font-black">
                      Файл «Описание урока»
                    </h4>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                    Это короткий паспорт конкретного урока. Он не заменяет папки
                    шагов, а помогает быстро понять тему, цель, материалы и
                    общую логику занятия перед переносом в сайт.
                  </p>

                  <div className="mt-5 rounded-lg border border-neutral-200 bg-white p-4">
                    <p className="text-sm font-bold text-neutral-950">
                      Сначала заполните краткий блок:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-neutral-700">
                      <li>Название: «Урок 1. Животные на ферме».</li>
                      <li>Место в курсе: модуль 1, урок 1.</li>
                      <li>Длительность: 45 минут.</li>
                      <li>
                        Цель: мягко включить детей в китайскую речь и обозначить
                        тему урока.
                      </li>
                      <li>Слова: 狗, 猫, 兔子, 马, 农场, 跑, 跳.</li>
                      <li>Фразы: 你是谁？, 我是…, 这是…, 我们…吧！, 在…里.</li>
                      <li>
                        Материалы: 1 видео, 1 песня, 2 рабочих листа, карточки
                        животных.
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-bold text-neutral-950">
                      Затем опишите разделы по порядку:
                    </p>
                    <ol className="mt-2 divide-y divide-neutral-200">
                      {lessonDescriptionSections.map((item, index) => (
                        <li key={item.title} className="flex gap-4 py-3">
                          <span className="w-12 shrink-0 text-3xl font-black leading-none text-indigo-200">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <h5 className="flex items-center gap-2 text-sm font-bold text-neutral-950">
                              <item.icon
                                className="h-4 w-4 shrink-0 text-neutral-400"
                                aria-hidden="true"
                              />
                              {item.title}
                            </h5>
                            <p className="mt-1 text-sm leading-6 text-neutral-700">
                              {item.text}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article
            id="step"
            className="rounded-lg border border-rose-200 bg-white p-5 md:p-6"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <span className="text-5xl font-black leading-none text-rose-200">
                05
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <IconBox icon={Layers} />
                  <h3 className="text-xl font-black">Шаги</h3>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                  Шаг — это один педагогический момент внутри урока. В каждом
                  шаге методист описывает онлайн-План Урока, офлайн-План Урока,
                  Экран ученика и материалы именно для этого шага.
                </p>
                <ul className="mt-4 grid gap-2 text-sm leading-6 text-neutral-700 md:grid-cols-2">
                  {stepChecklist.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2
                        className="mt-1 h-4 w-4 shrink-0 text-rose-700"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {stepCards.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-rose-100 bg-rose-50/40 p-4"
                    >
                      <IconBox icon={item.icon} />
                      <h4 className="mt-3 text-sm font-bold text-rose-950">
                        {item.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-neutral-700">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-lg border border-neutral-200 bg-[#fbfcff] p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <IconBox icon={FileText} />
                    <h4 className="text-lg font-black">Файл «Описание шага»</h4>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                    Этот файл лежит внутри папки шага. Он описывает один
                    педагогический момент и связывает онлайн-План, офлайн-План,
                    Экран ученика и материалы.
                  </p>

                  <div className="mt-5 rounded-lg border border-neutral-200 bg-white p-4">
                    <p className="text-sm font-bold text-neutral-950">
                      Сначала заполните краткий блок:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-neutral-700">
                      <li>Название: «Шаг 03. Карточки животных».</li>
                      <li>Время: 4 минуты.</li>
                      <li>Тип: лексика / видео / песня / активность.</li>
                      <li>
                        Цель: закрепить слова через карточки и повторение.
                      </li>
                      <li>
                        Материалы: animal-cards.pdf, dog-audio.mp3, экран с
                        визуальной опорой.
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-bold text-neutral-950">
                      Затем опишите разделы по порядку:
                    </p>
                    <ol className="mt-2 divide-y divide-neutral-200">
                      {stepDescriptionSections.map((item, index) => (
                        <li key={item.title} className="flex gap-4 py-3">
                          <span className="w-12 shrink-0 text-3xl font-black leading-none text-rose-200">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <h5 className="flex items-center gap-2 text-sm font-bold text-neutral-950">
                              <item.icon
                                className="h-4 w-4 shrink-0 text-neutral-400"
                                aria-hidden="true"
                              />
                              {item.title}
                            </h5>
                            <p className="mt-1 text-sm leading-6 text-neutral-700">
                              {item.text}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article
            id="homework"
            className="rounded-lg border border-orange-200 bg-white p-5 md:p-6"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <span className="text-5xl font-black leading-none text-orange-200">
                06
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <IconBox icon={ClipboardList} />
                  <h3 className="text-xl font-black">Домашнее задание</h3>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                  Домашнее задание относится к уроку целиком и лежит отдельным
                  файлом внутри папки урока. Его не нужно смешивать с
                  онлайн-Планом или офлайн-Планом.
                </p>
                <ul className="mt-4 grid gap-2 text-sm leading-6 text-neutral-700 md:grid-cols-2">
                  {homeworkChecklist.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2
                        className="mt-1 h-4 w-4 shrink-0 text-orange-700"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {homeworkCards.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-orange-100 bg-orange-50/40 p-4"
                    >
                      <IconBox icon={item.icon} />
                      <h4 className="mt-3 text-sm font-bold text-orange-950">
                        {item.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-neutral-700">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-lg border border-neutral-200 bg-[#fbfcff] p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <IconBox icon={FileText} />
                    <h4 className="text-lg font-black">
                      Файл «Домашнее задание»
                    </h4>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                    Этот файл объясняет, что увидит ученик или родитель после
                    занятия: задание, материалы, формат ответа и способ
                    проверки.
                  </p>

                  <div className="mt-5 rounded-lg border border-neutral-200 bg-white p-4">
                    <p className="text-sm font-bold text-neutral-950">
                      Сначала заполните краткий блок:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-neutral-700">
                      <li>
                        Название: «Практика дома: ферма, слова и команды».
                      </li>
                      <li>Ориентир по времени: 10 минут.</li>
                      <li>
                        Формат ответа: интерактивная практика + квиз из 5
                        вопросов.
                      </li>
                      <li>
                        Материалы: рабочая тетрадь, карточки животных,
                        презентация урока.
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-bold text-neutral-950">
                      Затем опишите разделы по порядку:
                    </p>
                    <ol className="mt-2 divide-y divide-neutral-200">
                      {homeworkDescriptionSections.map((item, index) => (
                        <li key={item.title} className="flex gap-4 py-3">
                          <span className="w-12 shrink-0 text-3xl font-black leading-none text-orange-200">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <h5 className="flex items-center gap-2 text-sm font-bold text-neutral-950">
                              <item.icon
                                className="h-4 w-4 shrink-0 text-neutral-400"
                                aria-hidden="true"
                              />
                              {item.title}
                            </h5>
                            <p className="mt-1 text-sm leading-6 text-neutral-700">
                              {item.text}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article
            id="materials"
            className="rounded-lg border border-teal-200 bg-white p-5 md:p-6"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <span className="text-5xl font-black leading-none text-teal-200">
                07
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <IconBox icon={Archive} />
                  <h3 className="text-xl font-black">Материалы</h3>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                  Материалы должны быть библиотекой, а не свалкой. Каждый файл
                  должен быть привязан к методике, уроку или конкретному шагу и
                  иметь понятное назначение.
                </p>
                <ul className="mt-4 grid gap-2 text-sm leading-6 text-neutral-700 md:grid-cols-2">
                  {materialRules.slice(0, 4).map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2
                        className="mt-1 h-4 w-4 shrink-0 text-teal-700"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {materialCards.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-teal-100 bg-teal-50/40 p-4"
                    >
                      <IconBox icon={item.icon} />
                      <h4 className="mt-3 text-sm font-bold text-teal-950">
                        {item.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-neutral-700">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-lg border border-neutral-200 bg-[#fbfcff] p-4 md:p-5">
                  <div className="flex items-center gap-3">
                    <IconBox icon={FileText} />
                    <h4 className="text-lg font-black">
                      Как описывать материалы
                    </h4>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                    Файл сам по себе не объясняет, когда и зачем он нужен.
                    Поэтому рядом с материалом или в описании шага нужно указать
                    назначение, формат и место использования.
                  </p>

                  <div className="mt-5 rounded-lg border border-neutral-200 bg-white p-4">
                    <p className="text-sm font-bold text-neutral-950">
                      Сначала проверьте базовые вещи:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm leading-6 text-neutral-700">
                      <li>Понятное название файла.</li>
                      <li>Понятно, к какому уроку или шагу он относится.</li>
                      <li>
                        Понятно, что с ним делать: показать, включить,
                        распечатать.
                      </li>
                      <li>
                        Если это офлайн-реквизит, понятно, как его подготовить.
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-bold text-neutral-950">
                      Затем опишите разделы по порядку:
                    </p>
                    <ol className="mt-2 divide-y divide-neutral-200">
                      {materialDescriptionSections.map((item, index) => (
                        <li key={item.title} className="flex gap-4 py-3">
                          <span className="w-12 shrink-0 text-3xl font-black leading-none text-teal-200">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <h5 className="flex items-center gap-2 text-sm font-bold text-neutral-950">
                              <item.icon
                                className="h-4 w-4 shrink-0 text-neutral-400"
                                aria-hidden="true"
                              />
                              {item.title}
                            </h5>
                            <p className="mt-1 text-sm leading-6 text-neutral-700">
                              {item.text}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="container">
        <div className="rounded-lg border border-neutral-900 bg-neutral-950 p-6 text-neutral-50">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <FileCode2 className="h-5 w-5" aria-hidden="true" />
                Итог
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                Методист отвечает за педагогическую ясность: порядок, цели,
                онлайн- и офлайн-инструкции, Экран ученика, материалы и
                ожидаемые результаты. Разработчик отвечает за перенос этой
                структуры в ShiDao без изменения методического смысла.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-200">
              Методика {"->"} Уроки {"->"} онлайн-План + офлайн-План + Экран
              ученика {"->"} Материалы {"->"} Домашка
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
