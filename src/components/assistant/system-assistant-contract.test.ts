import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("the assistant is mounted once inside the protected app layout only", async () => {
  const [appLayout, rootLayout, assistant, provider, service] =
    await Promise.all([
      source("src/app/(app)/layout.tsx"),
      source("src/app/layout.tsx"),
      source("src/components/assistant/system-assistant.tsx"),
      source("src/components/assistant/system-assistant-provider.tsx"),
      source("src/modules/ai/system-assistant-service.ts"),
    ]);

  assert.equal((appLayout.match(/<SystemAssistant\s*\/>/g) ?? []).length, 1);
  assert.equal((appLayout.match(/<SystemAssistantProvider>/g) ?? []).length, 1);
  assert.doesNotMatch(rootLayout, /SystemAssistant/);
  assert.match(assistant, /createPortal\(/);
  assert.match(assistant, /role="dialog"/);
  assert.match(assistant, /aria-modal="false"/);
  assert.match(assistant, /aria-haspopup="dialog"/);
  assert.match(assistant, /aria-expanded=\{open\}/);
  assert.match(assistant, /aria-controls=\{PANEL_ID\}/);
  assert.match(assistant, /htmlFor="system-assistant-message"/);
  assert.match(assistant, /textareaRef\.current\?\.focus/);
  assert.match(assistant, /event\.key !== "Escape"/);
  assert.match(assistant, /launcherRef\.current\?\.focus/);
  assert.doesNotMatch(assistant, /dangerouslySetInnerHTML/);
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

test("floating assistant uses the compact black holographic launcher contract", async () => {
  const [assistant, css] = await Promise.all([
    source("src/components/assistant/system-assistant.tsx"),
    source("src/app/styles/system-assistant.css"),
  ]);

  assert.match(
    assistant,
    /<span className="system-assistant-launcher-icon" aria-hidden="true">\s*\{open \? <X \/> : <Sparkles \/>\}\s*<\/span>/,
  );
  assert.doesNotMatch(
    assistant,
    /system-assistant-launcher[\s\S]*?<strong>ИИ<\/strong>/,
  );
  assert.match(css, /position:\s*fixed/);
  assert.match(
    css,
    /\.system-assistant-launcher\s*\{[\s\S]*?left: calc\(0\.75rem \+ env\(safe-area-inset-left, 0px\)\);[\s\S]*?bottom: calc\(0\.75rem \+ env\(safe-area-inset-bottom, 0px\)\);[\s\S]*?width: 2\.5rem;[\s\S]*?height: 2\.5rem;[\s\S]*?border: 0;[\s\S]*?border-radius: var\(--product-element-radius, 0\.75rem\);[\s\S]*?background: #000;/,
  );
  assert.match(css, /@keyframes system-assistant-hologram\s*\{/);
  assert.match(css, /@keyframes system-assistant-hologram-glint\s*\{/);
  assert.match(
    css,
    /\.system-assistant-panel\s*\{[\s\S]*?left: calc\(0\.75rem \+ env\(safe-area-inset-left, 0px\)\);[\s\S]*?bottom: calc\(4rem \+ env\(safe-area-inset-bottom, 0px\)\);/,
  );
  assert.match(css, /100dvh/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.system-assistant-launcher::before,[\s\S]*?\.system-assistant-launcher::after,[\s\S]*?animation: none !important;/,
  );
  assert.match(css, /z-index:\s*55/);
});
