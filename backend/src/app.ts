import type { HttpBindings } from "@hono/node-server";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import { zValidator } from "@hono/zod-validator";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { auth } from "./auth";
import {
	projectsRoutes,
	revisionsRoutes,
	translationsRoutes,
} from "./projects";
import { createMcpServer } from "./mcp";

const frontendURL = process.env.FRONTEND_URL ?? "http://localhost:3000";

const app = new Hono<{ Bindings: HttpBindings }>()
	.use("*", cors({ origin: [frontendURL], credentials: true }))
	.get("/health", (c) => c.json({ ok: true }))
	.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
	.get(
		"/api/hello",
		zValidator("query", z.object({ name: z.string().default("world") })),
		(c) => {
			const { name } = c.req.valid("query");
			return c.json({ greeting: `hello, ${name}` });
		},
	)
	.route("/api/projects", projectsRoutes)
	.route("/api/revisions", revisionsRoutes)
	.route("/api/translations", translationsRoutes)
	.all("/mcp", async (c) => {
		const server = createMcpServer();
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		c.env.outgoing.on("close", () => {
			void transport.close();
			void server.close();
		});

		await server.connect(transport);

		const parsedBody =
			c.req.method === "POST"
				? await c.req.json().catch(() => undefined)
				: undefined;

		await transport.handleRequest(c.env.incoming, c.env.outgoing, parsedBody);
		return RESPONSE_ALREADY_SENT;
	});

export type AppType = typeof app;
export { app };
