import { createAuthClient } from "better-auth/react";

// Same-origin: Next rewrites proxy /api/auth/* to the backend.
export const authClient = createAuthClient({
	baseURL: "/api/auth",
});
