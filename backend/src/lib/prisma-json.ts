// Helper to bridge our Zod-inferred shapes to Prisma's strict InputJsonValue.
// Prisma 7 narrows JSON columns aggressively ; our schemas use record(unknown)
// which is structurally compatible but TypeScript can't see that.

import type { Prisma } from "../../generated/prisma/client";

export type Json = Prisma.InputJsonValue;

export function asJson<T>(value: T): Json {
	return value as unknown as Json;
}
