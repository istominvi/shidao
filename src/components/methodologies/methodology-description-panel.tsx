import { Chip } from "@/components/ui/chip";
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

export function MethodologyDescriptionPanel({
  description,
}: {
  description: MethodologyDescriptionContent | null;
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
      <section className="space-y-4 border-b border-neutral-200 pb-6">
        <p className="text-sm leading-6 text-neutral-700">{description.lead}</p>

        <div className="flex flex-wrap gap-2">
          {description.passportFacts.map((fact) => (
            <Chip key={fact} tone="neutral">
              {fact}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {description.highlights.map((item) => (
            <Chip key={item} tone="sky">
              {item}
            </Chip>
          ))}
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

        if (section.type === "table") {
          return (
            <section key={section.id} className="space-y-3 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0">
              <SectionTitle title={section.title} />
              <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white/95">
                <table className="min-w-full divide-y divide-neutral-200 text-sm text-neutral-700">
                  <thead className="bg-neutral-50/80 text-neutral-900">
                    <tr>
                      {section.columns.map((column) => (
                        <th key={column} scope="col" className="px-4 py-2.5 text-left font-semibold">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {section.rows.map((row) => (
                      <tr key={row.section}>
                        <td className="px-4 py-2.5 font-medium text-neutral-900">{row.section}</td>
                        <td className="px-4 py-2.5">{row.period}</td>
                        <td className="px-4 py-2.5">{row.hours}</td>
                        <td className="px-4 py-2.5">{row.grammar}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
