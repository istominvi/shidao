import { startCourseBuilderMcpStdioServer } from "../src/modules/course-builder/mcp/stdio";

startCourseBuilderMcpStdioServer().catch(() => {
  // Never print environment values or the original error: stdout is the MCP
  // protocol and startup exceptions may contain configuration details.
  process.stderr.write(
    "[course-builder-mcp] Не удалось запустить локальный stdio server.\n",
  );
  process.exitCode = 1;
});
