"use client";

import { useQuery } from "@tanstack/react-query";
import { use, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

type Category = "all" | "entity" | "screen" | "field" | "form" | "project" | "other";

const CATEGORIES: { id: Category; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "entity", label: "Entities" },
	{ id: "screen", label: "Screens" },
	{ id: "field", label: "Fields" },
	{ id: "form", label: "Forms" },
	{ id: "project", label: "Project" },
	{ id: "other", label: "Other" },
];

function categoryOf(namespace: string): Category {
	const prefix = namespace.split(".")[0] ?? "";
	if (prefix === "entity") return "entity";
	if (prefix === "screen") return "screen";
	if (prefix === "field") return "field";
	if (prefix === "form") return "form";
	if (prefix === "project") return "project";
	return "other";
}

export default function TranslationsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const [active, setActive] = useState<Category>("all");

	const { data, isLoading, error } = useQuery({
		queryKey: ["translations", id],
		queryFn: async () => {
			const res = await api.api.projects[":id"].translations.$get({
				param: { id },
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});

	const grouped = useMemo(() => {
		const map = new Map<string, { ns: string; cat: Category; values: Record<string, string> }>();
		if (data && "translations" in data) {
			for (const t of data.translations) {
				const k = t.textKey.namespace;
				const entry = map.get(k) ?? {
					ns: k,
					cat: categoryOf(k),
					values: {},
				};
				entry.values[t.locale.code] = t.value;
				map.set(k, entry);
			}
		}
		return Array.from(map.values());
	}, [data]);

	const counts = useMemo(() => {
		const c: Record<string, number> = {
			all: grouped.length,
			entity: 0,
			screen: 0,
			field: 0,
			form: 0,
			project: 0,
			other: 0,
		};
		for (const row of grouped) c[row.cat] = (c[row.cat] ?? 0) + 1;
		return c;
	}, [grouped]);

	const rows = active === "all" ? grouped : grouped.filter((r) => r.cat === active);

	// Discover locale codes from data
	const locales = useMemo(() => {
		const set = new Set<string>();
		for (const row of grouped) for (const code of Object.keys(row.values)) set.add(code);
		return Array.from(set).sort();
	}, [grouped]);

	if (isLoading) return <EmptyState>Loading…</EmptyState>;
	if (error)
		return (
			<EmptyState>
				<span className="text-red-600">
					Error: {(error as Error).message}
				</span>
			</EmptyState>
		);
	if (!data) return null;

	return (
		<div>
			<PageHeader
				title="Translations"
				subtitle={`${grouped.length} keys · ${locales.length} locales`}
			/>

			<div className="mb-4 inline-flex flex-wrap gap-1 rounded-md border border-zinc-200 bg-white p-0.5">
				{CATEGORIES.map((c) => {
					const isActive = active === c.id;
					return (
						<button
							key={c.id}
							type="button"
							onClick={() => setActive(c.id)}
							className={cn(
								"rounded-sm px-3 py-1 text-xs font-medium transition-colors",
								isActive
									? "bg-blue-50 text-blue-700"
									: "text-zinc-600 hover:text-zinc-900",
							)}
						>
							{c.label}
							<span className="ml-1.5 text-zinc-400">
								{counts[c.id] ?? 0}
							</span>
						</button>
					);
				})}
			</div>

			{rows.length === 0 ? (
				<EmptyState>No translations in this category.</EmptyState>
			) : (
				<Card>
					<table className="w-full text-sm">
						<thead className="border-b border-zinc-200">
							<tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
								<th className="px-4 py-2 font-medium">Key</th>
								{locales.map((code) => (
									<th key={code} className="px-4 py-2 font-medium">
										{code}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-100">
							{rows.map((row) => (
								<tr key={row.ns}>
									<td className="px-4 py-2 font-mono text-xs text-zinc-700">
										{row.ns}
									</td>
									{locales.map((code) => (
										<td key={code} className="px-4 py-2 text-zinc-900">
											{row.values[code] ?? (
												<span className="text-zinc-300">—</span>
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</Card>
			)}
		</div>
	);
}
