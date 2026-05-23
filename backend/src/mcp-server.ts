// MCP server entry — runs over stdio. Launch separately from the HTTP server:
//   npm run mcp
// (TODO: HTTP transport will be wired once we pick between stdio-bridge or
// a Fetch-compatible transport. StreamableHTTPServerTransport currently needs
// Node's IncomingMessage which Hono doesn't expose by default.)

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp";

const server = createMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
