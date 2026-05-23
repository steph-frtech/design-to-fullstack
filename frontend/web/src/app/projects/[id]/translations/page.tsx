"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { type KeyboardEvent, use, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { readApiError } from "@/lib/api-error";
import { cn } from "@/lib/cn";

// Fields belong to Forms, so they share the "Forms" category.
type Category = "all" | "entity" | "screen" | "form" | "project" | "other";

const CATEGORIES: { id: Category; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "entity", label: "Entities" },
	{ id: "screen", label: "Screens" },
	{ id: "form", label: "Forms" },
	{ id: "project", label: "Project" },
	{ id: "other", label: "Other" },
];

function categoryOf(namespace: string): Category {
	const prefix = namespace.split(".")[0] ?? "";
	if (prefix === "entity") return "entity";
	if (prefix === "screen") return "screen";
	if (prefix === "form" || prefix === "field") return "form";
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
	const queryClient = useQueryClient();

	const { data, isLoading, error } = useQuery({
		queryKey: ["translations", id],
		queryFn: async () => {
			const res = await api.api.projects[":id"].translations.$get({
				param: { id },
			});
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
	});

	const projectQuery = useQuery({
		queryKey: ["project", id],
		queryFn: async () => {
			const res = await api.api.projects[":id"].$get({ param: { id } });
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
	});

	const upsert = useMutation({
		mutationFn: async (input: {
			namespace: string;
			localeCode: string;
			value: string;
		}) => {
			const res = await api.api.projects[":id"].translations.$put({
				param: { id },
				json: input,
			});
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["translations", id] });
		},
	});

	const grouped = useMemo(() => {
		const map = new Map<
			string,
			{ ns: string; cat: Category; values: Record<string, string> }
		>();
		if (data && "translations" in data) {
			for (const t of data.translations) {
				const k = t.textKey.namespace;
				const entry = map.get(k) ?? { ns: k, cat: categoryOf(k), values: {} };
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
			form: 0,
			project: 0,
			other: 0,
		};
		for (const row of grouped) c[row.cat] = (c[row.cat] ?? 0) + 1;
		return c;
	}, [grouped]);

	const rows = active === "all" ? grouped : grouped.filter((r) => r.cat === active);

	// Project's active locales for column headers (so we can show empty cells
	// for locales that have no value yet).
	const locales = useMemo(() => {
		if (projectQuery.data && "project" in projectQuery.data) {
			return projectQuery.data.project.locales
				.map((pl) => pl.locale.code)
				.sort();
		}
		// fallback: discover from translations
		const set = new Set<string>();
		for (const row of grouped) for (const c of Object.keys(row.values)) set.add(c);
		return Array.from(set).sort();
	}, [projectQuery.data, grouped]);

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
				subtitle={`${grouped.length} keys · ${locales.length} locales · click any cell to edit`}
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
							<span className="ml-1.5 text-zinc-400">{counts[c.id] ?? 0}</span>
						</button>
					);
				})}
			</div>

			{upsert.error && (
				<div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{(upsert.error as Error).message}
				</div>
			)}

			{rows.length === 0 ? (
				<EmptyState>No translations in this category.</EmptyState>
			) : (
				<Card className="overflow-hidden">
					<table className="w-full text-sm">
						<thead className="border-b border-zinc-200 bg-zinc-50">
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
									<td className="px-4 py-2 align-top font-mono text-xs text-zinc-700">
										{row.ns}
									</td>
									{locales.map((code) => (
										<EditableCell
											key={code}
											value={row.values[code] ?? ""}
											saving={upsert.isPending}
											onSave={(v) =>
												upsert.mutate({
													namespace: row.ns,
													localeCode: code,
													value: v,
												})
											}
										/>
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

function EditableCell({
	value,
	saving,
	onSave,
}: {
	value: string;
	saving: boolean;
	onSave: (v: string) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);

	function commit() {
		setEditing(false);
		if (draft !== value) onSave(draft);
	}

	function cancel() {
		setEditing(false);
		setDraft(value);
	}

	function onKey(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			e.preventDefault();
			commit();
		} else if (e.key === "Escape") {
			e.preventDefault();
			cancel();
		}
	}

	if (editing) {
		return (
			<td className="px-2 py-1 align-top">
				<Input
					autoFocus
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={commit}
					onKeyDown={onKey}
					disabled={saving}
					className="h-7 text-sm"
				/>
			</td>
		);
	}

	return (
		<td
			className="group cursor-text px-4 py-2 align-top text-zinc-900 hover:bg-zinc-50"
			onClick={() => {
				setDraft(value);
				setEditing(true);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					setDraft(value);
					setEditing(true);
				}
			}}
			tabIndex={0}
		>
			{value || <span className="text-zinc-300">— click to add</span>}
			<Pencil className="ml-2 inline h-3 w-3 text-zinc-300 opacity-0 group-hover:opacity-100" />
		</td>
	);
}
