import type {
  GuidedActivityBlock,
  IntroFramingBlock,
  LessonBlockInstance,
  MaterialsPrepBlock,
  ReusableAsset,
  SongSegmentBlock,
  TeacherPromptPatternBlock,
  VideoSegmentBlock,
  VocabularyFocusBlock,
  WorksheetTaskBlock,
  WrapUpClosureBlock,
} from "@/lib/lesson-content";
import type { TeacherLessonWorkspaceReadModel } from "@/lib/server/teacher-lesson-workspace";

type TeacherLessonWorkspaceProps = {
  workspace: TeacherLessonWorkspaceReadModel;
};

function formatRuntimeDateTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function formatRuntimeStatus(status: TeacherLessonWorkspaceReadModel["projection"]["runtimeShell"]["runtimeStatus"]) {
  switch (status) {
    case "planned":
      return "Запланирован";
    case "in_progress":
      return "Идёт";
    case "completed":
      return "Завершён";
    case "cancelled":
      return "Отменён";
    default:
      return status;
  }
}

function blockTypeLabel(blockType: LessonBlockInstance["blockType"]) {
  switch (blockType) {
    case "intro_framing":
      return "Ввод и рамка урока";
    case "video_segment":
      return "Видео-сегмент";
    case "song_segment":
      return "Песенный сегмент";
    case "vocabulary_focus":
      return "Фокус на лексике";
    case "teacher_prompt_pattern":
      return "Шаблоны реплик преподавателя";
    case "guided_activity":
      return "Управляемая активность";
    case "materials_prep":
      return "Подготовка материалов";
    case "worksheet_task":
      return "Задание по worksheet";
    case "wrap_up_closure":
      return "Завершение урока";
    default:
      return blockType;
  }
}

function AssetList({
  block,
  assetsById,
}: {
  block: LessonBlockInstance;
  assetsById: Record<string, ReusableAsset>;
}) {
  if (block.assetRefs.length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
        Ресурсы
      </p>
      <ul className="mt-2 space-y-1 text-sm text-neutral-700">
        {block.assetRefs.map((ref) => {
          const asset = assetsById[ref.id];
          if (!asset) {
            return (
              <li key={`${ref.kind}:${ref.id}`}>
                {ref.kind}: {ref.id}
              </li>
            );
          }

          return (
            <li key={asset.id}>
              {asset.sourceUrl ? (
                <a
                  href={asset.sourceUrl}
                  className="font-medium text-sky-700 underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {asset.title}
                </a>
              ) : (
                <span className="font-medium">{asset.title}</span>
              )}
              <span className="ml-2 text-xs text-neutral-500">({asset.kind})</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function renderBlockContent(block: LessonBlockInstance) {
  switch (block.blockType) {
    case "intro_framing": {
      const content = block.content as IntroFramingBlock["content"];
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li><b>Тема:</b> {content.title}</li>
          <li><b>Цель:</b> {content.goal}</li>
          <li><b>Скрипт преподавателя:</b> {content.teacherScriptShort}</li>
          {content.warmupQuestion ? <li><b>Разогрев:</b> {content.warmupQuestion}</li> : null}
          {content.timeboxMinutes ? <li><b>Таймбокс:</b> {content.timeboxMinutes} мин.</li> : null}
        </ul>
      );
    }
    case "video_segment": {
      const content = block.content as VideoSegmentBlock["content"];
      return (
        <>
          <p className="text-sm text-neutral-700"><b>Перед просмотром:</b> {content.promptBeforeWatch}</p>
          <p className="mt-2 text-sm text-neutral-700"><b>Фокус:</b> {content.focusPoints.join(", ")}</p>
          {content.questionsAfterWatch?.length ? (
            <p className="mt-2 text-sm text-neutral-700"><b>После просмотра:</b> {content.questionsAfterWatch.join("; ")}</p>
          ) : null}
        </>
      );
    }
    case "song_segment": {
      const content = block.content as SongSegmentBlock["content"];
      return (
        <>
          <p className="text-sm text-neutral-700"><b>Цель:</b> {content.activityGoal}</p>
          <p className="mt-2 text-sm text-neutral-700"><b>Действия:</b> {content.teacherActions.join("; ")}</p>
          {content.repeatCount ? <p className="mt-2 text-sm text-neutral-700"><b>Повторы:</b> {content.repeatCount}</p> : null}
          {content.movementHint ? <p className="mt-2 text-sm text-neutral-700"><b>Движение:</b> {content.movementHint}</p> : null}
        </>
      );
    }
    case "vocabulary_focus": {
      const content = block.content as VocabularyFocusBlock["content"];
      return (
        <>
          <p className="text-sm text-neutral-700"><b>Режим практики:</b> {content.practiceMode}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {content.items.map((item) => (
              <li key={`${item.term}-${item.pinyin}`}>
                {item.term} ({item.pinyin}) — {item.meaning}
              </li>
            ))}
          </ul>
          {content.miniDrill ? <p className="mt-2 text-sm text-neutral-700"><b>Мини-дрилл:</b> {content.miniDrill}</p> : null}
        </>
      );
    }
    case "teacher_prompt_pattern": {
      const content = block.content as TeacherPromptPatternBlock["content"];
      return (
        <>
          <p className="text-sm text-neutral-700"><b>Паттерны:</b> {content.promptPatterns.join("; ")}</p>
          <p className="mt-2 text-sm text-neutral-700"><b>Ожидаемые ответы:</b> {content.expectedStudentResponses.join("; ")}</p>
          {content.fallbackRu ? <p className="mt-2 text-sm text-neutral-700"><b>Подсказка RU:</b> {content.fallbackRu}</p> : null}
        </>
      );
    }
    case "guided_activity": {
      const content = block.content as GuidedActivityBlock["content"];
      return (
        <>
          <p className="text-sm text-neutral-700"><b>Тип активности:</b> {content.activityType}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
            {content.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <p className="mt-2 text-sm text-neutral-700"><b>Критерии успеха:</b> {content.successCriteria.join("; ")}</p>
        </>
      );
    }
    case "materials_prep": {
      const content = block.content as MaterialsPrepBlock["content"];
      return (
        <>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {content.materialsChecklist.map((item) => <li key={item}>{item}</li>)}
          </ul>
          {content.printCount ? <p className="mt-2 text-sm text-neutral-700"><b>Печать:</b> {content.printCount}</p> : null}
          {content.roomSetupNotes ? <p className="mt-2 text-sm text-neutral-700"><b>Подготовка комнаты:</b> {content.roomSetupNotes}</p> : null}
        </>
      );
    }
    case "worksheet_task": {
      const content = block.content as WorksheetTaskBlock["content"];
      return (
        <>
          <p className="text-sm text-neutral-700"><b>Инструкция:</b> {content.taskInstruction}</p>
          <p className="mt-2 text-sm text-neutral-700"><b>Режим:</b> {content.completionMode === "in_class" ? "В классе" : "Домой"}</p>
          {content.answerKeyHint ? <p className="mt-2 text-sm text-neutral-700"><b>Проверка:</b> {content.answerKeyHint}</p> : null}
          {content.homeExtension ? <p className="mt-2 text-sm text-neutral-700"><b>Домашнее расширение:</b> {content.homeExtension}</p> : null}
        </>
      );
    }
    case "wrap_up_closure": {
      const content = block.content as WrapUpClosureBlock["content"];
      return (
        <>
          <p className="text-sm text-neutral-700"><b>Рекап:</b> {content.recapPoints.join(", ")}</p>
          <p className="mt-2 text-sm text-neutral-700"><b>Exit check:</b> {content.exitCheck}</p>
          {content.previewNextLesson ? <p className="mt-2 text-sm text-neutral-700"><b>Следующий урок:</b> {content.previewNextLesson}</p> : null}
        </>
      );
    }
    default:
      return null;
  }
}

export function TeacherLessonWorkspace({ workspace }: TeacherLessonWorkspaceProps) {
  const { projection } = workspace;
  const runtime = projection.runtimeShell;
  const methodology = projection.methodologyShell;

  return (
    <div className="space-y-6">
      <header className="landing-surface rounded-3xl border border-white/70 p-6 shadow-[0_16px_48px_rgba(20,20,20,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Рабочее пространство преподавателя</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.02em] text-neutral-900">{methodology.title}</h1>
        <p className="mt-2 text-sm text-neutral-700">Конкретное проведение урока для класса {workspace.classId}. Блоки идут из методологической базы и доступны только для чтения.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="landing-surface rounded-3xl border border-sky-200/70 p-5">
          <h2 className="text-lg font-bold text-neutral-900">Runtime shell</h2>
          <ul className="mt-3 space-y-1 text-sm text-neutral-700">
            <li><b>Время:</b> {formatRuntimeDateTime(runtime.startsAt)}</li>
            <li><b>Формат:</b> {runtime.format === "online" ? "Онлайн" : "Оффлайн"}</li>
            {runtime.format === "online" ? (
              <li><b>Ссылка:</b> <a className="text-sky-700 underline" href={runtime.meetingLink} target="_blank" rel="noreferrer">{runtime.meetingLink}</a></li>
            ) : (
              <li><b>Место:</b> {runtime.place}</li>
            )}
            <li><b>Статус:</b> {formatRuntimeStatus(runtime.runtimeStatus)}</li>
            {runtime.runtimeNotesSummary ? <li><b>Краткая runtime-заметка:</b> {runtime.runtimeNotesSummary}</li> : null}
          </ul>
        </article>

        <article className="landing-surface rounded-3xl border border-violet-200/70 p-5">
          <h2 className="text-lg font-bold text-neutral-900">Methodology shell</h2>
          <ul className="mt-3 space-y-1 text-sm text-neutral-700">
            <li><b>Позиция:</b> модуль {methodology.position.moduleIndex}, урок {methodology.position.lessonIndex}{methodology.position.unitIndex ? `, unit ${methodology.position.unitIndex}` : ""}</li>
            <li><b>Лексика:</b> {methodology.vocabularySummary.join(", ") || "—"}</li>
            <li><b>Фразы:</b> {methodology.phraseSummary.join(", ") || "—"}</li>
            <li><b>Длительность:</b> {methodology.estimatedDurationMinutes} мин.</li>
            <li><b>Медиа:</b> видео {methodology.mediaSummary.videos}, песен {methodology.mediaSummary.songs}, worksheet {methodology.mediaSummary.worksheets}, другое {methodology.mediaSummary.other}</li>
            <li><b>Готовность:</b> {methodology.readinessStatus}</li>
          </ul>
        </article>
      </section>

      <section className="landing-surface rounded-3xl border border-white/70 p-5">
        <h2 className="text-xl font-bold text-neutral-900">Блоки урока (по порядку)</h2>
        <div className="mt-4 space-y-4">
          {projection.orderedBlocks.map((block) => (
            <article key={block.id} className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">#{block.order} · {blockTypeLabel(block.blockType)}</p>
              {block.title ? <h3 className="mt-2 text-base font-semibold text-neutral-900">{block.title}</h3> : null}
              <div className="mt-2">{renderBlockContent(block)}</div>
              <AssetList block={block} assetsById={workspace.assetsById} />
            </article>
          ))}
        </div>
      </section>

      <section className="landing-surface rounded-3xl border border-white/70 p-5">
        <h2 className="text-xl font-bold text-neutral-900">Заметки преподавателя</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-neutral-200 p-4">
            <h3 className="font-semibold text-neutral-900">Runtime notes</h3>
            <p className="mt-2 text-sm text-neutral-700">{projection.runtimeNotes?.trim() ? projection.runtimeNotes : "Пока нет заметок по проведению."}</p>
          </article>
          <article className="rounded-2xl border border-neutral-200 p-4">
            <h3 className="font-semibold text-neutral-900">Outcome notes</h3>
            <p className="mt-2 text-sm text-neutral-700">{projection.outcomeNotes?.trim() ? projection.outcomeNotes : "Пока нет итоговых заметок."}</p>
          </article>
        </div>
      </section>
    </div>
  );
}
