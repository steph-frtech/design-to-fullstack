import type { AppType } from "backend";
import { hc } from "hono/client";

// Empty base = same origin; Next rewrites in next.config.ts proxy
// /api/* and /mcp to the backend. Works regardless of the host you
// access the frontend from (localhost, sagedesk.fr, IP, etc.).
export const api = hc<AppType>("", {
	init: { credentials: "include" },
});
