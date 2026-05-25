// Shared zValidator hook — returns { error, issues } on validation failure.
import type { Context } from "hono";
import type { ZodError } from "zod";

export function validationHook<T>(
	result: { success: true; data: T } | { success: false; error: ZodError },
	c: Context,
) {
	if (!result.success) {
		return c.json(
			{
				error: "validation_failed",
				issues: result.error.issues.map((i) => ({
					path: i.path.join("."),
					message: i.message,
				})),
			},
			400,
		);
	}
}
