import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.PORT ?? 4002);

serve({ fetch: app.fetch, port }, ({ port }) => {
	console.log(`backend listening on http://localhost:${port}`);
});
