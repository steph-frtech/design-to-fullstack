"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { api } from "@/lib/api";

export default function ProjectDetail({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const { data, isLoading, error } = useQuery({
		queryKey: ["project", id],
		queryFn: async () => {
			const res = await api.api.projects[":id"].$get({ param: { id } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});

	if (isLoading) return <p className="text-zinc-500">Loading…</p>;
	if (error) return <p className="text-red-600">Error: {(error as Error).message}</p>;
	if (!data || "error" in data) return <p>Project not found.</p>;

	const { project } = data;

	return (
		<div className="space-y-8">
			<div>
				<Link href="/" className="text-sm text-zinc-500 hover:underline">
					← Projects
				</Link>
				<h1 className="mt-2 text-2xl font-semibold">{project.slug}</h1>
				<p className="text-sm text-zinc-500">
					Default locale: <code>{project.defaultLocale.code}</code> · v
					{project.currentVersion}
				</p>
			</div>

			<section>
				<h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
					Locales
				</h2>
				<div className="flex flex-wrap gap-2">
					{project.locales.map((pl) => (
						<span
							key={pl.localeId}
							className="rounded-full border border-zinc-200 px-3 py-1 text-xs dark:border-zinc-800"
						>
							{pl.locale.code} — {pl.locale.name}
						</span>
					))}
				</div>
			</section>

			<section>
				<h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
					Entities ({project.entities.length})
				</h2>
				<ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
					{project.entities.map((e) => (
						<li key={e.id} className="flex items-baseline justify-between py-2">
							<span className="font-mono text-sm">{e.name}</span>
							<span className="text-xs text-zinc-500">
								{e._count.attributes} attrs · {e._count.records} records · v
								{e.currentVersion}
							</span>
						</li>
					))}
				</ul>
			</section>

			<section>
				<h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
					Screens ({project.screens.length})
				</h2>
				<ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
					{project.screens.map((s) => (
						<li key={s.id} className="py-2">
							<Link
								href={`/projects/${project.id}/screens/${s.id}`}
								className="flex items-baseline justify-between hover:underline"
							>
								<span className="font-mono text-sm">{s.path}</span>
								<span className="text-xs text-zinc-500">
									{s._count.components} components · v{s.currentVersion}
								</span>
							</Link>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
