import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("the communication center is mounted once inside the protected app layout only", async () => {
  const [appLayout, rootLayout, center, provider, service] = await Promise.all([
    source("src/app/(app)/layout.tsx"),
    source("src/app/layout.tsx"),
    source("src/components/communication/communication-center.tsx"),
    source("src/components/assistant/system-assistant-provider.tsx"),
    source("src/modules/ai/system-assistant-service.ts"),
  ]);

  assert.equal(
    (appLayout.match(/<CommunicationCenter\s*\/>/g) ?? []).length,
    1,
  );
  assert.equal(
    (appLayout.match(/<CommunicationCenterProvider>/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(appLayout, /<SystemAssistant\s*\/>/);
  assert.equal((appLayout.match(/<SystemAssistantProvider>/g) ?? []).length, 1);
  assert.doesNotMatch(rootLayout, /CommunicationCenter|SystemAssistant/);
  assert.match(center, /createPortal\(/);
  assert.match(center, /role="dialog"/);
  assert.match(center, /aria-modal=\{mobile\}/);
  assert.match(center, /aria-haspopup="dialog"/);
  assert.match(center, /aria-expanded=\{open\}/);
  assert.match(center, /aria-controls=\{PANEL_ID\}/);
  assert.match(center, /event\.key === "Escape"/);
  assert.match(center, /setLauncherElement/);
  assert.doesNotMatch(center, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(provider, /window\.location|location\.href|\.hash/);
  assert.doesNotMatch(provider, /useSearchParams|querySelector|innerText/);
  assert.match(provider, /pathname === "\/profile"/);
  assert.match(provider, /surface: "learning_profile"[\s\S]*label: "Профиль"/);
  assert.doesNotMatch(provider, /pathname === "\/learning-profile"/);
  assert.match(service, /learning_profile: "Профиль"/);
});

test("Course and Lesson headers no longer own an assistant dialog", async () => {
  const [courseWorkspace, lessonWorkspace] = await Promise.all([
    source("src/components/course-builder/course-workspace.tsx"),
    source("src/components/course-builder/lesson-authoring-workspace.tsx"),
  ]);
  for (const file of [courseWorkspace, lessonWorkspace]) {
    assert.doesNotMatch(file, /AiCourseAssistantDialog/);
    assert.doesNotMatch(file, /ИИ-ассистент/);
  }
  assert.match(courseWorkspace, /lesson_\$\{navigation\.lessonSurface\}/);
  assert.match(courseWorkspace, /course_\$\{navigation\.courseSurface\}/);
  assert.match(lessonWorkspace, /Дополнить с ИИ/);
  assert.match(lessonWorkspace, /Заполнить с ИИ/);
});

test("global assistant routes keep active Account, explicit apply and user-JWT boundaries", async () => {
  const [chatRoute, applyRoute, serverContext] = await Promise.all([
    source("src/app/api/v2/assistant/route.ts"),
    source("src/app/api/v2/assistant/actions/apply/route.ts"),
    source("src/modules/course-builder/server-context.ts"),
  ]);
  assert.match(chatRoute, /getActiveCourseBuilderContext/);
  assert.match(chatRoute, /runBoundedAiRequest/);
  assert.match(applyRoute, /runBoundedAiRequest/);
  assert.match(applyRoute, /runIdempotentAiAssistantAction/);
  assert.match(applyRoute, /runExclusiveAiApply/);
  assert.doesNotMatch(chatRoute, /mcp|service.role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(
    applyRoute,
    /mcp|service.role|SUPABASE_SERVICE_ROLE_KEY/i,
  );
  assert.match(serverContext, /resolveAccessPolicy/);
  assert.match(serverContext, /resolution\.status !== "account"/);
});

test("unified messages uses the compact opal launcher contract", async () => {
  const [center, css] = await Promise.all([
    source("src/components/communication/communication-center.tsx"),
    source("src/app/styles/communication-center.css"),
  ]);
  const launcherWrapRule = css.match(
    /\.communication-center-launcher-wrap\s*\{([\s\S]*?)\n\}/,
  )?.[1];
  const launcherRule = css.match(
    /\.communication-center-launcher\s*\{([\s\S]*?)\n\}/,
  )?.[1];
  const panelRule = css.match(
    /\.communication-center-panel\s*\{([\s\S]*?)\n\}/,
  )?.[1];
  const reducedMotion = css.slice(
    css.indexOf("@media (prefers-reduced-motion: reduce)"),
  );

  assert.ok(launcherWrapRule);
  assert.ok(launcherRule);
  assert.ok(panelRule);
  assert.match(center, /<MessageCircle aria-hidden="true" \/>/);
  assert.match(center, /communication-center-badge/);
  assert.doesNotMatch(center, /<feTurbulence|<animate|repeatCount=/);
  assert.match(launcherWrapRule, /position:\s*fixed/);
  assert.match(
    launcherWrapRule,
    /right: calc\(0\.75rem \+ env\(safe-area-inset-right, 0px\)\);/,
  );
  assert.doesNotMatch(launcherWrapRule, /\bleft:/);
  assert.match(
    launcherWrapRule,
    /bottom: calc\(0\.75rem \+ env\(safe-area-inset-bottom, 0px\)\);/,
  );
  assert.match(launcherRule, /width: 2\.5rem;/);
  assert.match(launcherRule, /height: 2\.5rem;/);
  assert.match(launcherRule, /border: 0;/);
  assert.match(
    launcherRule,
    /border-radius: var\(--product-element-radius, 0\.75rem\);/,
  );
  assert.match(
    launcherRule,
    /background: linear-gradient\([\s\S]*?#91f5f0[\s\S]*?#adf9df[\s\S]*?#f7ffff[\s\S]*?#ddb0ea[\s\S]*?#f0bff5/,
  );
  assert.doesNotMatch(launcherRule, /background:\s*#000/);
  assert.match(
    panelRule,
    /right: calc\(0\.75rem \+ env\(safe-area-inset-right, 0px\)\);/,
  );
  assert.doesNotMatch(panelRule, /\bleft:/);
  assert.match(
    panelRule,
    /bottom: calc\(4rem \+ env\(safe-area-inset-bottom, 0px\)\);/,
  );
  assert.match(css, /100dvh/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(reducedMotion, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    reducedMotion,
    /\.communication-center-launcher,[\s\S]*?\.communication-center-panel,[\s\S]*?animation: none !important;/,
  );
  assert.match(
    reducedMotion,
    /\.communication-center-launcher\s*\{\s*transition: none;/,
  );
  assert.match(
    reducedMotion,
    /\.communication-center-launcher:hover,[\s\S]*?\.communication-center-launcher:active\s*\{\s*transform: none;/,
  );
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /background: ButtonFace;/);
  assert.match(css, /\.communication-center-layer\s*\{[\s\S]*?z-index:\s*70/);
});
