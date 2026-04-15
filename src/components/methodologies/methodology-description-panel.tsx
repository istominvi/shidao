import Image from "next/image";
import { BookOpenCheck, BrainCircuit, Globe2, HeartHandshake } from "lucide-react";
import {
  ProductTable,
  ProductTableBody,
  ProductTableCell,
  ProductTableHead,
  ProductTableHeaderCell,
  ProductTableHeaderRow,
  ProductTableRow,
} from "@/components/ui/product-table";
import type { MethodologyDescriptionContent } from "@/lib/methodologies/methodology-description-content";

function SectionTitle({ title }: { title: string }) {
  return <h3 className="text-base font-semibold text-neutral-950">{title}</h3>;
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

function GoalIcon({ kind }: { kind: "book" | "globe" | "brain" | "heart" }) {
  if (kind === "book") return <BookOpenCheck className="h-4 w-4" aria-hidden="true" />;
  if (kind === "globe") return <Globe2 className="h-4 w-4" aria-hidden="true" />;
  if (kind === "brain") return <BrainCircuit className="h-4 w-4" aria-hidden="true" />;
  return <HeartHandshake className="h-4 w-4" aria-hidden="true" />;
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
      <section className="space-y-3 border-b border-neutral-200 pb-6">
        <SectionTitle title="О программе" />
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {coverImage?.src ? (
            <div className="relative aspect-square w-full max-w-[180px] overflow-hidden rounded-2xl border border-black/10 bg-neutral-50">
              <Image
                src={coverImage.src}
                alt={coverImage.alt}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 160px, 180px"
              />
            </div>
          ) : null}

          <div className="space-y-3 text-sm leading-6 text-neutral-700 md:pt-1">
            <p>{description.lead}</p>
            {description.introParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {description.sections.map((section) => {
        if (section.type === "rich_text") {
          return (
            <section key={section.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
              <SectionTitle title={section.title} />
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
              <SectionTitle title={section.title} />
              <DotList items={section.items} />
            </section>
          );
        }

        if (section.type === "goal_map") {
          return (
            <section key={section.id} className="space-y-4 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
              <SectionTitle title={section.title} />

              <div className="space-y-3 text-sm leading-6 text-neutral-700">
                {section.contextParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  Ценностные ориентиры
                </h4>
                <div className="mt-3">
                  <DotList items={section.valueOrientations} />
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  Ключевые стратегические цели
                </h4>
                <div className="mt-3">
                  <DotList items={section.strategicGoals} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {section.taskGroups.map((group) => (
                  <section
                    key={`${section.id}-${group.title}`}
                    className="rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_8px_18px_rgba(20,20,20,0.04)]"
                  >
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700">
                        <GoalIcon kind={group.icon} />
                      </span>
                      {group.title}
                    </h4>
                    <div className="mt-2">
                      <DotList items={group.items} />
                    </div>
                  </section>
                ))}
              </div>
            </section>
          );
        }

        if (section.type === "table") {
          return (
            <section key={section.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
              <SectionTitle title={section.title} />
              <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white/95">
                <ProductTable className="table-auto">
                  <colgroup>
                    <col className="w-[21%]" />
                    <col className="w-[15%]" />
                    <col className="w-[8%]" />
                    <col className="w-[27%]" />
                    <col className="w-[29%]" />
                  </colgroup>
                  <ProductTableHead>
                    <ProductTableHeaderRow>
                      {section.columns.map((column) => (
                        <ProductTableHeaderCell key={column}>{column}</ProductTableHeaderCell>
                      ))}
                    </ProductTableHeaderRow>
                  </ProductTableHead>
                  <ProductTableBody>
                    {section.rows.map((row) => (
                      <ProductTableRow key={row.section}>
                        <ProductTableCell className="text-neutral-700">{row.section}</ProductTableCell>
                        <ProductTableCell>{row.period}</ProductTableCell>
                        <ProductTableCell>{row.hours}</ProductTableCell>
                        <ProductTableCell>{row.grammar}</ProductTableCell>
                        <ProductTableCell>
                          <span className="whitespace-pre-line">
                            {row.lessons.join("\n")}
                          </span>
                        </ProductTableCell>
                      </ProductTableRow>
                    ))}
                  </ProductTableBody>
                </ProductTable>
              </div>
            </section>
          );
        }

        if (section.type === "grouped_bullets") {
          return (
            <section key={section.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
              <SectionTitle title={section.title} />
              <div className="grid gap-3 md:grid-cols-2">
                {section.groups.map((group) => (
                  <section
                    key={`${section.id}-${group.title}`}
                    className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3"
                  >
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{group.title}</h4>
                    <div className="mt-2">
                      <DotList items={group.items} />
                    </div>
                  </section>
                ))}
              </div>
            </section>
          );
        }

        return (
          <section key={section.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
            <SectionTitle title={section.title} />
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
