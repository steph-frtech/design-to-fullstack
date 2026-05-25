// QueryConfig — typed shape for Resource.queryConfig.
// Pagination + filter + sort + search.

import { z } from "zod";

export const queryConfigSchema = z.object({
	pagination: z
		.object({
			kind: z.enum(["offset", "cursor"]),
			default: z.number().int().positive().max(1000),
			max: z.number().int().positive().max(10_000),
		})
		.optional(),
	sort: z
		.object({
			allowed: z.array(z.string().min(1)),
			default: z.array(z.string().min(1)).optional(),
		})
		.optional(),
	filter: z
		.array(
			z.object({
				field: z.string().min(1),
				operators: z.array(
					z.enum(["eq", "in", "contains", "gt", "gte", "lt", "lte"]),
				),
			}),
		)
		.optional(),
	search: z
		.object({
			fields: z.array(z.string().min(1)).min(1),
			mode: z.enum(["ilike", "fulltext", "external"]),
		})
		.optional(),
});

export type QueryConfig = z.infer<typeof queryConfigSchema>;
