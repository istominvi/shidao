import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".test.js")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const files = (await collectTestFiles(".test-dist")).sort((left, right) =>
    left.localeCompare(right),
  );

  if (files.length === 0) {
    console.error("No compiled .test.js files found in .test-dist.");
    process.exit(1);
  }

  const child = spawn(process.execPath, ["--test", ...files], {
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (typeof code === "number") {
      process.exit(code);
      return;
    }

    console.error(`Test runner terminated by signal: ${signal}`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
