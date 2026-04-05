import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

function parseArgs(argv) {
  const include = [];
  const exclude = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === "--include" && typeof value === "string") {
      include.push(value);
      index += 1;
      continue;
    }

    if (token === "--exclude" && typeof value === "string") {
      exclude.push(value);
      index += 1;
    }
  }

  return { include, exclude };
}

function matchesFilters(file, options) {
  const normalized = file.replaceAll("\\", "/");

  if (options.include.length > 0) {
    const included = options.include.some((pattern) =>
      normalized.includes(pattern),
    );

    if (!included) {
      return false;
    }
  }

  return !options.exclude.some((pattern) => normalized.includes(pattern));
}

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
  const filters = parseArgs(process.argv.slice(2));
  const files = (await collectTestFiles(".test-dist")).sort((left, right) =>
    left.localeCompare(right),
  );
  const filteredFiles = files.filter((file) => matchesFilters(file, filters));

  if (filteredFiles.length === 0) {
    console.error("No compiled .test.js files matched current test filters.");
    process.exit(1);
  }

  const child = spawn(process.execPath, ["--test", ...filteredFiles], {
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
