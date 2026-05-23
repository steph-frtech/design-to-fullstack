import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createMcpServer() {
	const server = new McpServer({
		name: "design-to-fullstack",
		version: "0.0.0",
	});

	server.tool(
		"echo",
		"Echo back a message — placeholder to verify MCP transport works.",
		{ message: z.string() },
		async ({ message }) => ({
			content: [{ type: "text", text: `echo: ${message}` }],
		}),
	);

	return server;
}
