import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  createCourseBuilderMcpServer,
  type CreateCourseBuilderMcpServerOptions,
} from "./server";

/**
 * Local-only transport. There is deliberately no HTTP listener or route for
 * the milestone MCP server.
 */
export async function startCourseBuilderMcpStdioServer(
  options: CreateCourseBuilderMcpServerOptions = {},
) {
  const server = createCourseBuilderMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}
