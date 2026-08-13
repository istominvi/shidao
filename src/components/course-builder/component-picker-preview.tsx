import {
  ArrowRight,
  Check,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers3,
  Play,
  Volume2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ComponentTypeKey } from "@/modules/course-builder/registry/contracts";

export type ComponentPickerPresentation = Readonly<{
  description: string;
  preview: ReactNode;
}>;

function PreviewLine({
  width = "w-full",
  strong = false,
}: {
  width?: string;
  strong?: boolean;
}) {
  return (
    <span
      className={`block h-1.5 rounded-full ${width} ${strong ? "bg-neutral-700" : "bg-neutral-300"}`}
    />
  );
}

function ChoiceRow({
  checked = false,
  width = "w-20",
  square = false,
}: {
  checked?: boolean;
  width?: string;
  square?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`grid h-3.5 w-3.5 shrink-0 place-items-center border ${square ? "rounded-[0.2rem]" : "rounded-full"} ${checked ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}
      >
        {checked ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : null}
      </span>
      <span className={`h-1.5 rounded-full bg-neutral-300 ${width}`} />
    </span>
  );
}

export const componentPickerPresentations = {
  heading: {
    description: "Короткое название раздела или смыслового блока.",
    preview: (
      <span className="grid gap-2">
        <span className="text-[0.78rem] font-semibold leading-none text-neutral-900">
          Новая тема
        </span>
        <PreviewLine width="w-24" />
        <PreviewLine width="w-16" />
      </span>
    ),
  },
  rich_text: {
    description: "Абзацы основного текста с простым форматированием.",
    preview: (
      <span className="grid gap-2">
        <span className="flex gap-1.5">
          <PreviewLine width="w-12" strong />
          <PreviewLine width="w-20" />
          <PreviewLine width="w-10" />
        </span>
        <PreviewLine />
        <PreviewLine width="w-4/5" />
        <PreviewLine width="w-2/3" />
      </span>
    ),
  },
  callout: {
    description: "Выделенная подсказка, пояснение или предупреждение.",
    preview: (
      <span className="grid gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          <PreviewLine width="w-16" strong />
        </span>
        <PreviewLine />
        <PreviewLine width="w-3/4" />
      </span>
    ),
  },
  quote: {
    description: "Цитата с необязательной подписью автора.",
    preview: (
      <span className="grid gap-2 border-l-2 border-violet-300 bg-violet-50/70 py-2 pl-3 pr-2">
        <span className="text-[0.7rem] italic leading-4 text-neutral-700">
          «Важная мысль урока»
        </span>
        <span className="text-[0.6rem] leading-none text-neutral-500">
          — Автор
        </span>
      </span>
    ),
  },
  image: {
    description: "Одно изображение из материалов курса.",
    preview: (
      <span className="grid h-full place-items-center rounded-lg border border-neutral-200 bg-white">
        <span className="grid place-items-center gap-1.5 text-neutral-400">
          <ImageIcon className="h-6 w-6" aria-hidden="true" />
          <span className="text-[0.6rem] leading-none">Изображение</span>
        </span>
      </span>
    ),
  },
  video: {
    description: "Видео по защищённой HTTPS-ссылке.",
    preview: (
      <span className="grid h-full place-items-center rounded-lg bg-neutral-800">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-neutral-900 shadow-sm">
          <Play className="ml-0.5 h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
    ),
  },
  audio: {
    description: "Аудиозапись с необязательным транскриптом.",
    preview: (
      <span className="flex h-full items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1">
          {[3, 6, 9, 5, 8, 4, 7, 3, 6, 4].map((height, index) => (
            <span
              key={`${height}-${index}`}
              className="w-1 rounded-full bg-sky-400"
              style={{ height: `${height}px` }}
            />
          ))}
        </span>
        <span className="text-[0.58rem] text-neutral-500">0:42</span>
      </span>
    ),
  },
  slideshow: {
    description: "Несколько изображений с последовательным просмотром.",
    preview: (
      <span className="relative block h-full">
        <span className="absolute inset-x-6 bottom-1 top-3 rounded-lg border border-neutral-200 bg-neutral-200" />
        <span className="absolute inset-x-3 bottom-3 top-1 grid place-items-center rounded-lg border border-neutral-300 bg-white shadow-sm">
          <Layers3 className="h-5 w-5 text-neutral-400" aria-hidden="true" />
        </span>
        <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
        </span>
      </span>
    ),
  },
  single_choice_poll: {
    description: "Один вопрос без заранее правильного ответа.",
    preview: (
      <span className="grid gap-2">
        <PreviewLine width="w-28" strong />
        <ChoiceRow width="w-20" checked />
        <ChoiceRow width="w-24" />
        <ChoiceRow width="w-16" />
      </span>
    ),
  },
  matching_game: {
    description: "Сопоставление элементов из двух колонок.",
    preview: (
      <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-1.5">
        {["Слово", "Термин", "Фраза"].map((label, index) => (
          <span key={label} className="contents">
            <span className="rounded-md border border-violet-200 bg-white px-2 py-1 text-[0.58rem] text-neutral-700">
              {label}
            </span>
            <ArrowRight
              className="h-3 w-3 text-violet-400"
              aria-hidden="true"
            />
            <span className="rounded-md border border-violet-200 bg-white px-2 py-1 text-[0.58rem] text-neutral-700">
              {index + 1}
            </span>
          </span>
        ))}
      </span>
    ),
  },
  choice_quiz: {
    description: "Тест с одним или несколькими правильными вариантами.",
    preview: (
      <span className="grid gap-2">
        <PreviewLine width="w-32" strong />
        <ChoiceRow width="w-24" square checked />
        <ChoiceRow width="w-20" square />
        <ChoiceRow width="w-28" square />
      </span>
    ),
  },
  fill_blanks: {
    description: "Ввод слов или выражений в пропуски текста.",
    preview: (
      <span className="flex h-full flex-wrap content-center items-end gap-x-1.5 gap-y-2 text-[0.65rem] leading-4 text-neutral-600">
        <span>Столица</span>
        <span>Франции</span>
        <span>—</span>
        <span className="min-w-14 border-b border-indigo-400 pb-0.5 text-center text-indigo-700">
          ответ
        </span>
        <span>.</span>
        <span className="w-full" />
        <span>Следующий</span>
        <span className="min-w-10 border-b border-indigo-400 pb-0.5" />
      </span>
    ),
  },
  word_bank: {
    description: "Выбор подходящих слов из готового банка.",
    preview: (
      <span className="grid h-full content-center gap-3">
        <span className="flex items-center gap-1.5 text-[0.65rem] text-neutral-600">
          <span>Фраза с</span>
          <span className="inline-block w-14 border-b border-indigo-400" />
        </span>
        <span className="flex flex-wrap gap-1.5">
          {["слово", "вариант", "лишнее"].map((word) => (
            <span
              key={word}
              className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[0.56rem] text-indigo-800"
            >
              {word}
            </span>
          ))}
        </span>
      </span>
    ),
  },
  sequence: {
    description: "Восстановление правильного порядка элементов.",
    preview: (
      <span className="grid gap-1.5">
        {["Начало", "Продолжение", "Завершение"].map((label, index) => (
          <span
            key={label}
            className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1"
          >
            <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-indigo-100 text-[0.55rem] font-medium text-indigo-800">
              {index + 1}
            </span>
            <span className="text-[0.58rem] text-neutral-600">{label}</span>
          </span>
        ))}
      </span>
    ),
  },
  categorize: {
    description: "Распределение элементов по заданным категориям.",
    preview: (
      <span className="grid h-full grid-cols-2 gap-2">
        {["Категория А", "Категория Б"].map((label, categoryIndex) => (
          <span
            key={label}
            className="rounded-lg border border-teal-200 bg-white p-2"
          >
            <span className="block text-[0.56rem] font-medium text-teal-900">
              {label}
            </span>
            <span className="mt-2 grid gap-1">
              <PreviewLine width={categoryIndex === 0 ? "w-12" : "w-10"} />
              <PreviewLine width={categoryIndex === 0 ? "w-8" : "w-14"} />
            </span>
          </span>
        ))}
      </span>
    ),
  },
  free_response: {
    description: "Короткий или развёрнутый ответ ученика.",
    preview: (
      <span className="grid gap-2">
        <PreviewLine width="w-28" strong />
        <span className="grid h-12 content-start gap-1.5 rounded-lg border border-neutral-300 bg-white p-2.5">
          <PreviewLine width="w-4/5" />
          <PreviewLine width="w-2/3" />
        </span>
      </span>
    ),
  },
  external_link: {
    description: "Ссылка на внешний материал или страницу.",
    preview: (
      <span className="flex h-full items-center justify-between gap-3 rounded-lg border border-sky-200 bg-white px-3">
        <span className="min-w-0">
          <span className="block text-[0.65rem] font-medium text-neutral-800">
            Открыть материал
          </span>
          <span className="mt-1 block text-[0.55rem] text-neutral-500">
            https://example.com
          </span>
        </span>
        <ExternalLink
          className="h-4 w-4 shrink-0 text-sky-700"
          aria-hidden="true"
        />
      </span>
    ),
  },
  word_builder: {
    description: "Сборка слова из отдельных букв.",
    preview: (
      <span className="grid h-full place-content-center gap-3">
        <span className="flex justify-center gap-1.5">
          {["С", "Л", "О", "В", "О"].map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className="grid h-7 w-7 place-items-center rounded-md border border-indigo-300 bg-white text-[0.7rem] font-semibold text-indigo-950 shadow-sm"
            >
              {letter}
            </span>
          ))}
        </span>
        <span className="mx-auto h-px w-24 bg-indigo-200" />
      </span>
    ),
  },
  vocabulary_list: {
    description: "Список терминов с переводами или определениями.",
    preview: (
      <span className="grid gap-1.5">
        {[
          ["你好", "привет"],
          ["谢谢", "спасибо"],
          ["再见", "до свидания"],
        ].map(([term, definition]) => (
          <span
            key={term}
            className="grid grid-cols-[3.5rem_1fr] gap-2 rounded-md border border-teal-100 bg-white px-2 py-1"
          >
            <span className="text-[0.58rem] font-medium text-teal-950">
              {term}
            </span>
            <span className="text-[0.58rem] text-neutral-500">
              {definition}
            </span>
          </span>
        ))}
      </span>
    ),
  },
  file: {
    description: "Файл из материалов курса для открытия или скачивания.",
    preview: (
      <span className="flex h-full items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.65rem] font-medium text-neutral-800">
            Материал урока.pdf
          </span>
          <span className="mt-1 block text-[0.55rem] text-neutral-500">
            PDF · 2,4 МБ
          </span>
        </span>
      </span>
    ),
  },
} satisfies Record<ComponentTypeKey, ComponentPickerPresentation>;

export function ComponentPickerPreview({
  typeKey,
  className,
}: {
  typeKey: ComponentTypeKey;
  className?: string;
}) {
  const presentation = componentPickerPresentations[typeKey];
  const classes = [
    "component-picker-preview",
    `component-picker-preview-${typeKey}`,
    "pointer-events-none block h-20 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      data-component-preview={typeKey}
      aria-hidden="true"
    >
      {presentation.preview}
    </span>
  );
}
