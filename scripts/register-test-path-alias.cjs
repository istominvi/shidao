const Module = require("node:module");
const path = require("node:path");

const compiledRoot = path.resolve(process.cwd(), ".test-dist");
const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveTestPathAlias(
  request,
  parent,
  isMain,
  options,
) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(compiledRoot, request.slice(2))
    : request;

  return resolveFilename.call(this, resolvedRequest, parent, isMain, options);
};
