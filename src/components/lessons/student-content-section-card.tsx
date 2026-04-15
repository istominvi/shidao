import { BookOpen, CirclePlay, Flag, Footprints, Goal, Sparkles, Users } from "lucide-react";
import { classNames } from "@/lib/ui/classnames";
import type {
  MethodologyLessonStudentContentSection,
  ReusableAsset,
} from "@/lib/lesson-content";

type Props = {
  section: MethodologyLessonStudentContentSection;
  assetsById: Record<string, ReusableAsset>;
  embedded?: boolean;
};

function AssetCta({ label, url }: { label: string; url?: string }) {
  if (!url) {
    return (
      <p className="mt-2 text-xs text-neutral-500">
        Материал откроется здесь, когда будет добавлена ссылка.
      </p>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 inline-block text-xs text-sky-700 underline underline-offset-2"
    >
      {label}
    </a>
  );
}

export function StudentContentSectionCard({
  section,
  assetsById,
  embedded = false,
}: Props) {
  const cardClass = classNames(
    "rounded-2xl border p-4",
    embedded ? "bg-white/80" : "bg-white",
  );

  if (section.type === "hero_banner") {
    return (
      <article
        className={classNames(
          cardClass,
          "border-orange-200 bg-gradient-to-br from-amber-50 to-orange-50",
        )}
      >
        <h3 className="text-xl font-bold text-neutral-900">{section.title}</h3>
        {section.subtitle ? (
          <p className="mt-1 text-sm text-neutral-700">{section.subtitle}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {section.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-800"
            >
              {chip}
            </span>
          ))}
        </div>
      </article>
    );
  }

  if (section.type === "goal_cards") {
    return (
      <article className={classNames(cardClass, "border-sky-200 bg-sky-50/60")}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {section.goals.map((goal) => (
            <div
              key={goal.text}
              className="rounded-xl border border-sky-100 bg-white p-3 text-sm text-neutral-700"
            >
              {goal.icon ? (
                <span className="mr-2">{goal.icon}</span>
              ) : (
                <Goal className="mr-2 inline h-4 w-4 text-sky-700" />
              )}
              {goal.text}
            </div>
          ))}
        </div>
      </article>
    );
  }

  if (section.type === "story_scene") {
    return (
      <article className={classNames(cardClass, "border-amber-200 bg-amber-50/60")}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <p className="mt-2 text-base font-medium text-amber-900">
          {section.sceneLine}
        </p>
        {section.prompt ? (
          <p className="mt-1 text-sm text-neutral-700">{section.prompt}</p>
        ) : null}
      </article>
    );
  }

  if (section.type === "vocabulary_gallery") {
    return (
      <article className={classNames(cardClass, "border-violet-200 bg-violet-50/50")}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {section.items.map((item) => (
            <div
              key={item.term}
              className="rounded-xl border border-violet-100 bg-white p-3"
            >
              <p className="text-lg font-bold text-neutral-950">{item.term}</p>
              <p className="text-sm text-neutral-600">{item.pinyin ?? ""}</p>
              <p className="text-sm text-neutral-700">{item.meaning}</p>
              <p className="mt-1 text-xs text-violet-700">{item.category}</p>
            </div>
          ))}
        </div>
      </article>
    );
  }

  if (section.type === "phrase_drill") {
    return (
      <article className={classNames(cardClass, "border-indigo-200 bg-indigo-50/40")}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {section.items.map((item) => (
            <div
              key={item.phrase}
              className="rounded-xl border border-indigo-100 bg-white p-3"
            >
              <p className="text-lg font-bold">{item.phrase}</p>
              <p className="text-sm text-neutral-600">{item.pinyin ?? ""}</p>
              <p className="text-sm">{item.meaning}</p>
              {item.example ? (
                <p className="mt-1 text-xs text-neutral-600">
                  Например: {item.example}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </article>
    );
  }

  if (section.type === "movement_mission") {
    return (
      <article className={classNames(cardClass, "border-emerald-200 bg-emerald-50/70")}>
        <h3 className="font-semibold text-neutral-900">
          <Footprints className="mr-2 inline h-4 w-4" />
          {section.title}
        </h3>
        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
          {section.prompts.map((prompt) => (
            <li key={prompt}>• {prompt}</li>
          ))}
        </ul>
        {section.hints?.length ? (
          <p className="mt-2 text-xs text-emerald-800">
            {section.hints.join(" · ")}
          </p>
        ) : null}
      </article>
    );
  }

  if (section.type === "counting_task") {
    return (
      <article className={classNames(cardClass, "border-cyan-200 bg-cyan-50/60")}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <p className="mt-1 text-sm text-neutral-700">{section.task}</p>
        {section.countingRange ? (
          <p className="mt-1 text-xs text-cyan-800">
            Диапазон: {section.countingRange}
          </p>
        ) : null}
      </article>
    );
  }

  if (section.type === "farm_scene") {
    return (
      <article className={classNames(cardClass, "border-lime-200 bg-lime-50/50")}>
        <h3 className="font-semibold text-neutral-900">
          <Flag className="mr-2 inline h-4 w-4" />
          {section.title}
        </h3>
        <p className="mt-1 text-sm font-medium text-lime-900">{section.modelLine}</p>
        <p className="text-sm text-neutral-700">{section.childNote}</p>
      </article>
    );
  }

  if (section.type === "media_stage" || section.type === "song_stage") {
    const asset = section.assetId ? assetsById[section.assetId] : undefined;
    return (
      <article className={classNames(cardClass, "border-sky-200 bg-sky-50/60")}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <p className="mt-1 text-sm text-neutral-700">{section.prompt}</p>
        <p className="mt-1 text-xs text-neutral-600">
          {asset?.title ?? "Материал урока"}
        </p>
        <AssetCta
          label={
            section.type === "song_stage"
              ? "Открыть песню"
              : section.ctaLabel ?? "Открыть материал"
          }
          url={asset?.sourceUrl}
        />
      </article>
    );
  }

  if (section.type === "worksheet_preview") {
    const asset = section.assetId ? assetsById[section.assetId] : undefined;
    return (
      <article className={classNames(cardClass, "border-amber-200 bg-amber-50/60")}>
        <h3 className="font-semibold text-neutral-900">
          <BookOpen className="mr-2 inline h-4 w-4" />
          {section.title}
        </h3>
        <p className="mt-1 text-sm text-neutral-700">{section.instructions}</p>
        <p className="text-xs text-neutral-600">
          {section.pageLabel ?? asset?.title ?? "Worksheet"}
        </p>
        <AssetCta label="Открыть worksheet" url={asset?.sourceUrl} />
      </article>
    );
  }

  if (section.type === "home_recap" || section.type === "recap") {
    return (
      <article className={classNames(cardClass, "border-neutral-200 bg-neutral-50/60")}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
          {section.bullets.map((bullet) => (
            <li key={bullet}>• {bullet}</li>
          ))}
        </ul>
      </article>
    );
  }

  if (section.type === "parent_tip") {
    return (
      <article className={classNames(cardClass, "border-rose-200 bg-rose-50/60")}>
        <h3 className="font-semibold text-neutral-900">
          <Users className="mr-2 inline h-4 w-4" />
          {section.title}
        </h3>
        <p className="mt-1 text-sm text-neutral-700">{section.tip}</p>
      </article>
    );
  }

  if (section.type === "lesson_focus") {
    return (
      <article className={classNames(cardClass, "border-sky-200 bg-sky-50/40")}>
        <h3 className="font-semibold text-neutral-900">
          <Sparkles className="mr-2 inline h-4 w-4" />
          {section.title}
        </h3>
        <p className="mt-2 text-sm text-neutral-700">{section.body}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {section.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-white px-2 py-0.5 text-xs text-sky-800"
            >
              {chip}
            </span>
          ))}
        </div>
      </article>
    );
  }

  if (section.type === "vocabulary_cards") {
    return (
      <article className={cardClass}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {section.items.map((item) => (
            <div key={item.term} className="rounded-xl border border-neutral-200 p-3">
              <p className="text-lg font-bold">{item.term}</p>
              <p className="text-sm text-neutral-600">{item.pinyin ?? ""}</p>
              <p className="text-sm">{item.meaning}</p>
            </div>
          ))}
        </div>
      </article>
    );
  }

  if (section.type === "phrase_cards") {
    return (
      <article className={cardClass}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {section.items.map((item) => (
            <div
              key={item.phrase}
              className="rounded-xl border border-neutral-200 p-3"
            >
              <p className="font-bold">{item.phrase}</p>
              <p className="text-sm text-neutral-600">{item.pinyin ?? ""}</p>
              <p className="text-sm">{item.meaning}</p>
            </div>
          ))}
        </div>
      </article>
    );
  }

  if (section.type === "media_asset") {
    const asset = assetsById[section.assetId];
    return (
      <article className={classNames(cardClass, "border-sky-200 bg-sky-50/60")}>
        <h3 className="font-semibold text-neutral-900">
          <CirclePlay className="mr-2 inline h-4 w-4" />
          {section.title}
        </h3>
        <p className="mt-1 text-sm text-neutral-700">{section.studentPrompt}</p>
        <AssetCta label="Открыть материал" url={asset?.sourceUrl} />
      </article>
    );
  }

  if (section.type === "action_cards") {
    return (
      <article className={classNames(cardClass, "border-emerald-200 bg-emerald-50/60")}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {section.items.map((item) => (
            <li key={item.term}>
              {item.term} — {item.meaning}
            </li>
          ))}
        </ul>
      </article>
    );
  }

  if (section.type === "worksheet") {
    const asset = section.assetId ? assetsById[section.assetId] : undefined;
    return (
      <article className={classNames(cardClass, "border-amber-200 bg-amber-50/60")}>
        <h3 className="font-semibold text-neutral-900">{section.title}</h3>
        <p className="mt-1 text-sm text-neutral-700">{section.instructions}</p>
        <p className="text-xs text-neutral-600">
          {section.pageLabel ?? asset?.title ?? "Worksheet"}
        </p>
        <AssetCta label="Открыть worksheet" url={asset?.sourceUrl} />
      </article>
    );
  }

  return (
    <article className={cardClass}>
      <h3 className="font-semibold text-neutral-900">{section.title}</h3>
      <p className="mt-2 text-xs text-neutral-500">{section.type}</p>
    </article>
  );
}
