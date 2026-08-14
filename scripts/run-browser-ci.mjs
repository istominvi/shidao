import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const generatedTypeFiles = ["next-env.d.ts", "tsconfig.json"].map((file) => ({
  path: resolve(process.cwd(), file),
  content: readFileSync(resolve(process.cwd(), file)),
}));

let result;

try {
  result = spawnSync("npm", ["run", "test:browser"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-browser-smoke",
      REQUIRE_BROWSER_SMOKE: "1",
      BROWSER_SMOKE_SERVER_MODE: "prod",
    },
    stdio: "inherit",
  });
} finally {
  for (const file of generatedTypeFiles) {
    writeFileSync(file.path, file.content);
  }
}

if (result.error) throw result.error;
if (result.signal) process.kill(process.pid, result.signal);
process.exit(result.status ?? 1);
