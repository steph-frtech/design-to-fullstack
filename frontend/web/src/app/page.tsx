"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardMeta, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";

export default function ProjectsPage() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["projects"],
		queryFn: async () => {
			const res = await api.api.projects.$get();
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});

	return (
		<div>
			<PageHeader
				title="Projects"
				subtitle="Apps you've built from designs."
			/>

			{isLoading && (
				<EmptyState>Loading…</EmptyState>
			)}

			{error && (
				<EmptyState>
					<span className="text-rose-300">Error: {(error as Error).message}</span>
				</EmptyState>
			)}

			{data && data.projects.length === 0 && (
				<EmptyState>
					No projects yet. Run{" "}
					<code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-xs">
						pnpm --filter backend seed
					</code>{" "}
					to add demo data.
				</EmptyState>
			)}

			{data && data.projects.length > 0 && (
				<ul className="grid gap-4 sm:grid-cols-2">
					{data.projects.map((p) => (
						<li key={p.id}>
							<Link href={`/projects/${p.id}`} className="block">
								<Card>
									<CardTitle>{p.slug}</CardTitle>
									<CardMeta className="mt-2">
										{p._count.screens} screens · {p._count.entities} entities ·{" "}
										{p.defaultLocale.code}
									</CardMeta>
								</Card>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
