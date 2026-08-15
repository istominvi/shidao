import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const PAGE_HEADER_CONSUMER_PATHS = [
  "src/app/(app)/courses/page.tsx",
  "src/app/(app)/courses/new/page.tsx",
  "src/components/course-builder/course-workspace.tsx",
  "src/components/course-builder/lesson-authoring-workspace.tsx",
  "src/components/course-builder/published-course-workspace.tsx",
  "src/components/teaching-hub/students-workspace.tsx",
  "src/components/teaching-hub/schedule-workspace.tsx",
  "src/components/learner-identity/learning-profile-workspace.tsx",
  "src/components/learner-identity/observing-workspace.tsx",
  "src/components/learner-identity/invitation-accept-workspace.tsx",
  "src/components/store/store-workspace.tsx",
] as const;

function jsxElements(path: string, componentName: string) {
  const file = ts.createSourceFile(
    path,
    source(path),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const elements: Array<ts.JsxOpeningLikeElement> = [];

  function visit(node: ts.Node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(file) === componentName
    ) {
      elements.push(node);
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  return { elements, file };
}

function jsxAttribute(
  element: ts.JsxOpeningLikeElement,
  name: string,
): ts.JsxAttribute | undefined {
  return element.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText() === name,
  );
}

function expressionFor(attribute: ts.JsxAttribute) {
  assert.ok(
    attribute.initializer && ts.isJsxExpression(attribute.initializer),
    `${attribute.name.getText()} must use a JSX expression`,
  );
  assert.ok(attribute.initializer.expression);
  return attribute.initializer.expression;
}

function assertSingleActionRoot(
  expression: ts.Expression,
  context: string,
  allowedRoots: ReadonlySet<string>,
) {
  if (ts.isParenthesizedExpression(expression)) {
    assertSingleActionRoot(expression.expression, context, allowedRoots);
    return;
  }
  if (ts.isConditionalExpression(expression)) {
    assertSingleActionRoot(expression.whenTrue, context, allowedRoots);
    assertSingleActionRoot(expression.whenFalse, context, allowedRoots);
    return;
  }
  if (
    expression.kind === ts.SyntaxKind.NullKeyword ||
    expression.kind === ts.SyntaxKind.UndefinedKeyword
  ) {
    return;
  }

  assert.ok(
    ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression),
    `${context} must render at most one direct action control; use AppPageHeaderActions for overflow`,
  );
  const tagName = ts.isJsxElement(expression)
    ? expression.openingElement.tagName.getText()
    : expression.tagName.getText();
  assert.ok(
    allowedRoots.has(tagName),
    `${context} must render one control root, not a wrapper that can hide multiple direct actions`,
  );
}

test("active V2 pages share one page header contract without visual modifiers", () => {
  const header = source("src/components/app/page-header.tsx");
  const styles = source("src/app/globals.css");
  const motionStyles = source("src/app/styles/page-motion.css");
  const consumers = [
    source("src/app/(app)/courses/page.tsx"),
    source("src/app/(app)/courses/new/page.tsx"),
    source("src/components/course-builder/course-workspace.tsx"),
    source("src/components/course-builder/lesson-authoring-workspace.tsx"),
    source("src/components/course-builder/published-course-workspace.tsx"),
    source("src/components/teaching-hub/students-workspace.tsx"),
    source("src/components/teaching-hub/schedule-workspace.tsx"),
    source("src/components/learner-identity/learning-profile-workspace.tsx"),
    source("src/components/learner-identity/observing-workspace.tsx"),
    source("src/components/learner-identity/invitation-accept-workspace.tsx"),
    source("src/components/store/store-workspace.tsx"),
  ];
  const productHeaderApiConsumers = consumers;

  assert.match(header, /type: "link"/);
  assert.match(header, /type: "button"/);
  assert.match(header, /metric\?: ReactNode/);
  assert.match(header, /metricPending\?: boolean/);
  assert.doesNotMatch(header, /description\?: ReactNode/);
  assert.match(header, /direction="back"/);
  assert.match(header, /pageTransition\.runUpdate\("back", back\.onClick\)/);
  assert.match(header, /"app-page-header"/);
  assert.match(header, /back && "app-page-header-with-back"/);
  assert.match(header, /Boolean\(actions\) && "app-page-header-with-actions"/);
  assert.match(header, /className="app-page-header-content"/);
  assert.match(header, /className="app-page-back-link"/);
  assert.match(header, /className="app-page-back-link-label"/);
  assert.match(header, /className="app-page-actions"/);
  assert.match(header, /data-page-header-pending=/);
  assert.match(header, /data-page-header-async-metric=/);
  assert.match(header, /data-page-header-metric-placeholder=/);
  assert.match(header, /metricPending === true && !hasMetric/);
  assert.doesNotMatch(header, /hasRevealed|setHasRevealed/);
  assert.doesNotMatch(
    header,
    /<header[^>]*aria-busy=/,
    "Metric loading must not make the known title and actions busy",
  );
  assert.match(
    header,
    /className="app-page-description app-page-metric"[\s\S]*?aria-busy=/,
  );
  assert.match(header, /aria-live=\{usesAsyncMetric \? "polite" : undefined\}/);
  assert.doesNotMatch(header, /className\?: string/);
  assert.doesNotMatch(header, /eyebrow/i);
  assert.doesNotMatch(styles, /\.app-page-eyebrow/);
  assert.match(motionStyles, /view-transition-name: app-page-header/);
  assert.match(
    motionStyles,
    /data-page-transition-direction="forward"[\s\S]*?app-page-header-exit-left/,
  );
  assert.match(
    motionStyles,
    /data-page-transition-direction="back"[\s\S]*?app-page-header-exit-right/,
  );
  assert.match(
    motionStyles,
    /data-page-transition-fallback="exit"[\s\S]*?app-page-header-exit-left/,
  );
  assert.match(
    motionStyles,
    /data-page-transition-fallback="enter"[\s\S]*?app-page-header-enter-right/,
  );
  assert.match(
    motionStyles,
    /:root\[data-page-transition-direction\][\s\S]*?view-transition-name: none;/,
  );
  assert.match(
    motionStyles,
    /::view-transition\s*\{[^}]*pointer-events: none;/,
  );
  assert.match(motionStyles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(
    motionStyles,
    /data-page-header-pending[\s\S]*?visibility:\s*hidden/,
    "An unresolved metric must not hide the known title or actions",
  );
  assert.match(
    motionStyles,
    /data-page-header-async-metric[\s\S]*?\.app-page-metric\s*\{[^}]*opacity: 1;[^}]*transition: opacity 180ms ease;/,
  );
  assert.match(
    motionStyles,
    /data-page-header-async-metric[\s\S]*?\.app-page-metric\s*\{[^}]*min-block-size: 1lh;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/,
    "An async metric stays one reserved line when its real value appears",
  );
  assert.match(
    motionStyles,
    /data-page-header-metric-placeholder[\s\S]*?opacity: 0;/,
  );

  for (const consumer of productHeaderApiConsumers) {
    assert.doesNotMatch(consumer, /eyebrow=/);
  }

  assert.match(
    styles,
    /:root\s*\{[^}]*--product-secondary-foreground: oklch\(0\.19 0 0 \/ 0\.6\);/,
  );
  assert.match(
    styles,
    /\.app-page-header\s*\{[^}]*--app-page-header-description-color: var\(--product-secondary-foreground\);/,
  );
  assert.match(
    styles,
    /\.app-page-description\s*\{[^}]*color: var\(--app-page-header-description-color\);/,
  );
  assert.match(
    styles,
    /\.app-page-metric\[data-page-header-metric-placeholder\]\s*\{[^}]*block-size: 1lh;[^}]*overflow: hidden;/,
  );
  assert.doesNotMatch(
    styles,
    /\.course-demo-shell \.app-page-description\s*\{[^}]*color:/,
    "Product routes must inherit the canonical AppPageHeader subtitle color",
  );
  assert.match(
    styles,
    /\.app-page-header\s*\{[^}]*--app-page-header-back-gap: var\(--app-page-header-padding-block\);/,
  );
  assert.match(
    styles,
    /\.course-demo-shell \.app-page-header > \.app-page-actions\s*\{[^}]*width: max-content;[^}]*max-width: 100%;[^}]*align-self: flex-start;/,
  );
  assert.match(styles, /\.course-demo-shell\s*\{[^}]*overflow-x: clip;/);
  assert.match(
    styles,
    /@media \(max-width: 1279px\)\s*\{[\s\S]*?\.course-demo-shell \.app-page-header-with-actions\s*\{[^}]*flex-flow: row wrap;[^}]*align-items: center;[^}]*column-gap: 1\.5rem;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 1279px\)[\s\S]*?\.course-demo-shell\s*\.app-page-header-with-actions\s*> \.app-page-header-content\s*\{[^}]*width: auto;[^}]*flex: 1 1 auto;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 1279px\)[\s\S]*?\.course-demo-shell \.app-page-header-with-actions > \.app-page-actions\s*\{[^}]*flex: 0 0 auto;[^}]*align-self: center;/,
  );
  assert.match(
    styles,
    /@media \(min-width: 1280px\)\s*\{[\s\S]*?\.course-demo-shell \.app-page-header-with-actions\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) max-content;[^}]*column-gap: 1\.5rem;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell\s*\.app-page-header-with-actions\s*> \.app-page-header-content\s*\{[^}]*align-self: stretch;[^}]*justify-content: center;/,
  );
  assert.match(
    styles,
    /\.course-demo-shell\s*\.app-page-header-with-actions\.app-page-header-with-back\s*> \.app-page-header-content\s*\{[^}]*justify-content: flex-start;/,
  );
  assert.match(
    styles,
    /\.app-page-header-with-back \.app-page-back-link\s*\{[^}]*margin-bottom: calc\([\s\S]*?var\(--app-page-header-back-gap\) - var\(--app-page-header-space\)[\s\S]*?\);/,
  );
  assert.match(
    styles,
    /\.app-page-back-link\s*\{[^}]*min-width: 0;[^}]*max-width: min\(100%, 38rem\);[^}]*text-align: left;[^}]*color: #141414;/,
  );
  assert.match(styles, /\.app-page-back-link-icon\s*\{[^}]*flex: 0 0 auto;/);
  assert.match(
    styles,
    /\.app-page-back-link-label\s*\{[^}]*min-width: 0;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/,
  );
  assert.match(styles, /\.app-page-back-link:hover\s*\{[^}]*color: #141414;/);
  assert.match(
    styles,
    /\.app-page-back-link:focus-visible\s*\{[^}]*color: #141414;/,
  );
  assert.match(
    styles,
    /\.app-page-title\s*\{[^}]*width: 100%;[^}]*max-width: none;/,
  );
  assert.doesNotMatch(styles, /\.app-page-title\s*\{[^}]*24ch/);
  assert.match(
    styles,
    /\.course-demo-shell \.app-page-title,\s*\.course-demo-shell \.app-page-description\s*\{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/,
  );
  assert.doesNotMatch(
    styles,
    /\.app-page-back-link-label\s*\{[^}]*overflow-wrap: anywhere;/,
  );
  assert.doesNotMatch(
    styles,
    /\.course-demo-shell \.app-page-actions \.product-btn\s*\{[^}]*flex:\s*1;/,
    "Product page actions must keep their intrinsic width on narrow screens",
  );

  for (const consumer of consumers) {
    assert.match(consumer, /<AppPageHeader/);
    assert.doesNotMatch(
      consumer,
      /course-index-page-header|course-builder-page-header|teaching-hub-page-header|workspace-page-header/,
    );
  }
});

test("page headers reserve optional supporting copy for entity metrics and collapse lesson actions", () => {
  const actions = source("src/components/app/page-header-actions.tsx");
  const lesson = source(
    "src/components/course-builder/lesson-authoring-workspace.tsx",
  );
  const lessonHeader = lesson.slice(
    lesson.indexOf("<AppPageHeader"),
    lesson.indexOf("<WorkspaceTabs", lesson.indexOf("<AppPageHeader")),
  );
  const schedule = source("src/components/teaching-hub/schedule-workspace.tsx");
  const courses = source("src/app/(app)/courses/page.tsx");
  const students = source("src/components/teaching-hub/students-workspace.tsx");
  const learningProfile = source(
    "src/components/learner-identity/learning-profile-workspace.tsx",
  );

  assert.match(actions, /primary\?: ReactNode/);
  assert.match(actions, /triggerIcon=\{MoreVertical\}/);
  assert.match(actions, /portal/);
  assert.match(lessonHeader, /<AppPageHeaderActions/);
  assert.match(lessonHeader, /primary=\{/);
  assert.match(lessonHeader, /overflowItems=\{/);
  assert.match(lessonHeader, /destructive: true/);
  assert.match(lessonHeader, /metric=\{`Компонентов:/);
  assert.doesNotMatch(lessonHeader, /lesson\.summary/);

  for (const consumer of [schedule, courses, students]) {
    assert.doesNotMatch(
      consumer,
      /Здесь все назначенные|Создавайте свои курсы|с которыми вы работаете/,
    );
  }
  for (const consumer of [schedule, students, learningProfile]) {
    assert.match(consumer, /metricPending=\{headerMetricPending\}/);
    assert.match(consumer, /usePrimaryHeaderSummary\(\)/);
  }
});

test("every page-header consumer keeps metrics and action rails structurally clean", () => {
  const explanatoryCopy =
    /Здесь|Создавайте|Заполните|Только вы|История людей|ShiDao проверяет|Курс для самостоятельного|lesson\.summary/;
  const allowedHeaderActionRoots = new Set([
    "AppPageHeaderActions",
    "Button",
    "CourseActions",
    "PageTransitionLink",
  ]);

  for (const path of PAGE_HEADER_CONSUMER_PATHS) {
    const { elements, file } = jsxElements(path, "AppPageHeader");
    assert.ok(elements.length > 0, `${path} must render AppPageHeader`);

    for (const element of elements) {
      assert.equal(
        jsxAttribute(element, "description"),
        undefined,
        `${path} must not restore the explanatory description prop`,
      );

      const metric = jsxAttribute(element, "metric");
      if (metric) {
        assert.doesNotMatch(
          metric.getText(file),
          explanatoryCopy,
          `${path} header supporting copy must remain an entity metric`,
        );
      }

      const actions = jsxAttribute(element, "actions");
      if (!actions) continue;
      const expression = expressionFor(actions);
      assertSingleActionRoot(
        expression,
        `${path} AppPageHeader actions`,
        allowedHeaderActionRoots,
      );

      let containsChip = false;
      function visitAction(node: ts.Node) {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          node.tagName.getText(file) === "Chip"
        ) {
          containsChip = true;
        }
        ts.forEachChild(node, visitAction);
      }
      visitAction(expression);
      assert.equal(
        containsChip,
        false,
        `${path} must place informational chips in meta, not actions`,
      );
    }
  }

  const lessonActions = jsxElements(
    "src/components/course-builder/lesson-authoring-workspace.tsx",
    "AppPageHeaderActions",
  );
  assert.equal(lessonActions.elements.length, 1);
  const lessonPrimary = jsxAttribute(lessonActions.elements[0], "primary");
  assert.ok(lessonPrimary);
  assertSingleActionRoot(
    expressionFor(lessonPrimary),
    "Lesson AppPageHeaderActions primary",
    new Set(["Button", "LessonRunStatusButton"]),
  );
});
