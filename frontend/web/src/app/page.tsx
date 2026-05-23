"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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
			<h1 className="mb-6 text-2xl font-semibold">Projects</h1>
			{isLoading && <p className="text-zinc-500">Loading…</p>}
			{error && <p className="text-red-600">Error: {(error as Error).message}</p>}
			{data && data.projects.length === 0 && (
				<p className="text-zinc-500">
					No projects yet. Run{" "}
					<code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
						pnpm --filter backend seed
					</code>{" "}
					to add demo data.
				</p>
			)}
			{data && data.projects.length > 0 && (
				<ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
					{data.projects.map((p) => (
						<li key={p.id} className="py-3">
							<Link
								href={`/projects/${p.id}`}
								className="flex items-baseline justify-between hover:underline"
							>
								<span className="font-medium">{p.slug}</span>
								<span className="text-sm text-zinc-500">
									{p._count.screens} screens · {p._count.entities} entities ·{" "}
									{p.defaultLocale.code}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
