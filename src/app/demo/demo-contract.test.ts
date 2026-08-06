import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const demoDirectory = join(process.cwd(), "src/app/demo");
const pageSource = readFileSync(join(demoDirectory, "page.tsx"), "utf8");
const experienceSource = readFileSync(
  join(demoDirectory, "demo-experience.tsx"),
  "utf8",
);
const modelPageSource = readFileSync(
  join(process.cwd(), "src/app/model/model-page-client.tsx"),
  "utf8",
);

test("standalone demo keeps its restored navigation and visual entry point", () => {
  assert.match(pageSource, /import "\.\/demo-v2\.css"/);
  assert.match(pageSource, /<DemoExperience \/>/);
  assert.match(experienceSource, /label: "Расписание"/);
  assert.match(experienceSource, /label: "Ученики"/);
  assert.match(experienceSource, /label: "Курсы"/);
  assert.match(
    experienceSource,
    /case "lesson":\s+return "\/courses\/english-b1\/lessons\/present-perfect"/,
  );
  assert.match(modelPageSource, /href="https:\/\/demo\.shidao\.ru"/);
});

test("standalone demo remains a client-only fictional prototype", () => {
  assert.doesNotMatch(experienceSource, /\bfetch\s*\(/);
  assert.doesNotMatch(experienceSource, /["'`]\/api\//);
  assert.doesNotMatch(experienceSource, /supabase/i);
  assert.doesNotMatch(experienceSource, /localStorage|sessionStorage/);
  assert.doesNotMatch(experienceSource, /@\/lib\/(?:server|services)/);
});
