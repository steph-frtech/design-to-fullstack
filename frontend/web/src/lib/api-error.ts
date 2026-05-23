// Extract a readable string from an API response body. Handles:
//   { error: "slug_taken" }
//   { error: "validation_failed", issues: [{ path, message }] }
//   { success: false, error: { issues: [...] } } (Hono zod default)
//   plain Error/string

export async function readApiError(res: Response): Promise<string> {
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return `HTTP ${res.status}`;
	}
	return formatApiError(body, res.status);
}

export function formatApiError(body: unknown, status?: number): string {
	if (typeof body === "string") return body;
	if (!body || typeof body !== "object") return `HTTP ${status ?? "error"}`;
	const b = body as Record<string, unknown>;

	// Our standard shape: { error: "code", issues?: [{path, message}] }
	if (typeof b.error === "string") {
		if (Array.isArray(b.issues) && b.issues.length > 0) {
			const first = b.issues[0] as { path?: string; message?: string };
			return first.message
				? `${first.path ? `${first.path}: ` : ""}${first.message}`
				: b.error;
		}
		return b.error;
	}

	// Hono zod-validator default: { success: false, error: { issues: [...] } }
	if (b.success === false && b.error && typeof b.error === "object") {
		const inner = b.error as { issues?: Array<{ path?: unknown[]; message?: string }> };
		if (Array.isArray(inner.issues) && inner.issues.length > 0) {
			const it = inner.issues[0];
			const path = Array.isArray(it.path) ? it.path.join(".") : "";
			return it.message ? `${path ? `${path}: ` : ""}${it.message}` : "Invalid input";
		}
	}

	return `HTTP ${status ?? "error"}`;
}
