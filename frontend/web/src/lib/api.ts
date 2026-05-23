import type { AppType } from "backend";
import { hc } from "hono/client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export const api = hc<AppType>(BACKEND_URL, {
	init: { credentials: "include" },
});
