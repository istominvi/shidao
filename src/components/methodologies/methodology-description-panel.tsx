import Image from "next/image";
import type { ReactNode } from "react";
import {
  BookOpenCheck,
  Clock3,
  Globe2,
  HeartHandshake,
  Lightbulb,
  Music2,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type { MethodologyDescriptionContent } from "@/lib/methodologies/methodology-description-content";

function SectionTitle({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-950">
      {icon ? (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700">
          {icon}
        </span>
      ) : null}
      {title}
    </h3>
  );
}

function DotList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-relaxed text-neutral-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionIcon({ id }: { id: string }) {
  if (id === "course-dna") return <Sparkles className="h-4 w-4" aria-hidden="true" />;
  if (id === "how-to-work") return <BookOpenCheck className="h-4 w-4" aria-hidden="true" />;
  if (id === "lesson-anatomy") return <Clock3 className="h-4 w-4" aria-hidden="true" />;
  if (id === "pedagogical-principles") return <Lightbulb className="h-4 w-4" aria-hidden="true" />;
  if (id === "learning-outcomes") return <HeartHandshake className="h-4 w-4" aria-hidden="true" />;
  if (id === "thematic-map") return <Globe2 className="h-4 w-4" aria-hidden="true" />;
  if (id === "materials-ecosystem") return <Users className="h-4 w-4" aria-hidden="true" />;
  return <Sparkles className="h-4 w-4" aria-hidden="true" />;
}

function CardIcon({ icon }: { icon: "book" | "music" | "video" | "users" | "clock" | "sparkles" }) {
  if (icon === "book") return <BookOpenCheck className="h-4 w-4" aria-hidden="true" />;
  if (icon === "music") return <Music2 className="h-4 w-4" aria-hidden="true" />;
  if (icon === "video") return <Video className="h-4 w-4" aria-hidden="true" />;
  if (icon === "users") return <Users className="h-4 w-4" aria-hidden="true" />;
  if (icon === "clock") return <Clock3 className="h-4 w-4" aria-hidden="true" />;
  return <Sparkles className="h-4 w-4" aria-hidden="true" />;
}

export function MethodologyDescriptionPanel({
  description,
  coverImage,
}: {
  description: MethodologyDescriptionContent | null;
  coverImage?: {
    src: string;
    alt: string;
  } | null;
}) {
  if (!description) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70 p-6 text-sm text-neutral-600">
        Подробное описание методики пока не заполнено.
      </div>
    );
  }

  return (
    <section className="space-y-8" aria-label="Описание методики">
      <section className="rounded-2xl border border-neutral-200 bg-gradient-to-b from-sky-50/70 to-white p-5 md:p-6">
        <SectionTitle title="Паспорт программы" icon={<BookOpenCheck className="h-4 w-4" aria-hidden="true" />} />
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-start">
          {coverImage?.src ? (
            <div className="relative aspect-square w-full max-w-[180px] overflow-hidden rounded-2xl border border-black/10 bg-neutral-50">
              <Image src={coverImage.src} alt={coverImage.alt} fill className="object-contain" sizes="(max-width: 768px) 160px, 180px" />
            </div>
          ) : null}

          <div className="min-w-0 space-y-3 text-sm leading-6 text-neutral-700 md:pt-1">
            <p className="text-neutral-900">{description.lead}</p>
            {description.introParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {description.passportFacts.map((fact) => (
            <div key={fact.label} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">{fact.label}</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{fact.value}</p>
            </div>
          ))}
        </div>
      </section>

      {description.sections.map((section) => {
        if (section.type === "rich_text") {
          return (
            <section key={section.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
              <SectionTitle title={section.title} icon={<SectionIcon id={section.id} />} />
              <div className="space-y-3 text-sm leading-6 text-neutral-700">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          );
        }

        if (section.type === "bullets") {
          return (
            <section key={section.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
              <SectionTitle title={section.title} icon={<SectionIcon id={section.id} />} />
              <DotList items={section.items} />
            </section>
          );
        }

        if (section.type === "fact_cards") {
          return (
            <section key={section.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
              <SectionTitle title={section.title} icon={<SectionIcon id={section.id} />} />
              <div className="grid gap-3 md:grid-cols-2">
                {section.cards.map((card) => (
                  <article key={card.title} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-[0_8px_18px_rgba(20,20,20,0.04)]">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700">
                        <CardIcon icon={card.icon} />
                      </span>
                      {card.title}
                    </h4>
                    <p className="mt-2 text-sm text-neutral-700">{card.description}</p>
                  </article>
                ))}
              </div>
            </section>
          );
        }

        if (section.type === "grouped_bullets") {
          return (
            <section key={section.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
              <SectionTitle title={section.title} icon={<SectionIcon id={section.id} />} />
              <div className="grid gap-3 md:grid-cols-2">
                {section.groups.map((group) => (
                  <article key={group.title} className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{group.title}</h4>
                    <div className="mt-2">
                      <DotList items={group.items} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        }

        if (section.type === "anatomy_flow") {
          return (
            <section key={section.id} className="space-y-4 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
              <SectionTitle title={section.title} icon={<SectionIcon id={section.id} />} />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {section.stages.map((stage, index) => (
                  <article key={stage.title} className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Chip tone="sky" size="sm">Этап {index + 1}</Chip>
                      {stage.timeHint ? <span className="text-xs font-medium text-sky-800">{stage.timeHint}</span> : null}
                    </div>
                    <h4 className="mt-2 text-sm font-semibold text-neutral-900">{stage.title}</h4>
                    <p className="mt-1 text-sm text-neutral-700">{stage.description}</p>
                  </article>
                ))}
              </div>
            </section>
          );
        }

        return (
          <section key={section.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
            <SectionTitle title={section.title} icon={<SectionIcon id={section.id} />} />
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-neutral-700 marker:font-semibold marker:text-neutral-500">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
        );
      })}
    </section>
  );
}
