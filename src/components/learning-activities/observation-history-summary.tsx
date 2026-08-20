import type { ObservationSummary } from "./observation-format";
import styles from "./run-observation-workspace.module.css";

export function ObservationHistorySummary({
  summary,
  title = "Сводка по компоненту",
  description,
}: {
  summary: ObservationSummary;
  title?: string;
  description?: string;
}) {
  return (
    <section
      className={styles.summary}
      aria-labelledby="observation-summary-title"
    >
      <div className={styles.summaryHeading}>
        <div>
          <p className={styles.eyebrow}>Наблюдение</p>
          <h2 id="observation-summary-title" className={styles.summaryTitle}>
            {title}
          </h2>
          {description ? (
            <p className={styles.summaryDescription}>{description}</p>
          ) : null}
        </div>
        <strong className={styles.summaryCoverage}>
          {summary.observedLearners} из {summary.totalLearners}
          <span> наблюдались</span>
        </strong>
      </div>
      <dl className={styles.summaryMetrics}>
        <div data-tone="success">
          <dt>Самостоятельно</dt>
          <dd>{summary.independent}</dd>
        </div>
        <div data-tone="support">
          <dt>С помощью</dt>
          <dd>{summary.withSupport}</dd>
        </div>
        <div data-tone="attention">
          <dt>Пока не получилось</dt>
          <dd>{summary.notYet}</dd>
        </div>
        <div data-tone="neutral">
          <dt>Не наблюдал</dt>
          <dd>{summary.notObserved}</dd>
        </div>
      </dl>
    </section>
  );
}
