"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";

export default function TranslationsPage() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["translations"],
		queryFn: async () => {
			const res = await api.api.translations.$get({ query: {} });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});

	if (isLoading) return <EmptyState>Loading…</EmptyState>;
	if (error)
		return (
			<EmptyState>
				<span className="text-red-600">
					Error: {(error as Error).message}
				</span>
			</EmptyState>
		);
	if (!data || "error" in data) return null;

	const grouped = new Map<string, { en?: string; fr?: string; ns: string }>();
	for (const t of data.translations) {
		const k = t.textKey.namespace;
		const entry = grouped.get(k) ?? { ns: k };
		(entry as Record<string, string>)[t.locale.code] = t.value;
		grouped.set(k, entry);
	}

	return (
		<div>
			<PageHeader
				title="Translations"
				subtitle={`${grouped.size} text keys, ${data.translations.length} values across locales`}
			/>

			{grouped.size === 0 ? (
				<EmptyState>No translations.</EmptyState>
			) : (
				<Card>
					<table className="w-full text-sm">
						<thead className="border-b border-zinc-200">
							<tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
								<th className="px-4 py-2 font-medium">Key</th>
								<th className="px-4 py-2 font-medium">en</th>
								<th className="px-4 py-2 font-medium">fr</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-100">
							{Array.from(grouped.values()).map((row) => (
								<tr key={row.ns}>
									<td className="px-4 py-2 font-mono text-xs text-zinc-700">
										{row.ns}
									</td>
									<td className="px-4 py-2 text-zinc-900">{row.en ?? "—"}</td>
									<td className="px-4 py-2 text-zinc-900">{row.fr ?? "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
			)}
		</div>
	);
}
