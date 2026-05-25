"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, Folder, GitBranch } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { ManageLocalesDialog } from "@/components/manage-locales-dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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

	if (isLoading) return <EmptyState>Loading…</EmptyState>;
	if (error)
		return (
			<EmptyState>
				<span className="text-red-600">
					Error: {(error as Error).message}
				</span>
			</EmptyState>
		);
	if (!data || "error" in data)
		return <EmptyState>Project not found.</EmptyState>;

	const { project } = data;

	return (
		<div>
			<PageHeader
				back={{ href: "/", label: "Projects" }}
				title={project.slug}
				subtitle={
					<>
						Default locale{" "}
						<code className="rounded-sm bg-zinc-100 px-1 py-0.5 font-mono text-xs text-zinc-700">
							{project.defaultLocale.code}
						</code>{" "}
						· v{project.currentVersion}
					</>
				}
			/>

			<div className="space-y-8">
				{(project.localPath ||
					project.githubRepo ||
					(project.enabledScreenTypes && project.enabledScreenTypes.length > 0)) && (
					<Section title="Setup">
						<Card>
							<dl className="divide-y divide-zinc-100 text-sm">
								{project.localPath && (
									<SetupRow
										icon={<Folder className="h-3.5 w-3.5 text-zinc-500" />}
										label="Local directory"
										value={
											<code className="font-mono text-xs text-zinc-700">
												{project.localPath}
											</code>
										}
									/>
								)}
								{project.githubRepo && (
									<SetupRow
										icon={<GitBranch className="h-3.5 w-3.5 text-zinc-500" />}
										label="GitHub repo"
										value={
											<a
												href={`https://github.com/${project.githubRepo}`}
												target="_blank"
												rel="noreferrer"
												className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 underline-offset-2 hover:underline"
											>
												{project.githubRepo}
												<ExternalLink className="h-3 w-3" />
											</a>
										}
									/>
								)}
								{project.enabledScreenTypes &&
									project.enabledScreenTypes.length > 0 && (
										<SetupRow
											label="Surfaces"
											value={
												<div className="flex flex-wrap gap-1">
													{project.enabledScreenTypes.map((t) => (
														<Badge key={t} variant="info">
															{t}
														</Badge>
													))}
												</div>
											}
										/>
									)}
							</dl>
						</Card>
					</Section>
				)}

				<Section
					title="Locales"
					count={project.locales.length}
					action={
						<ManageLocalesDialog
							projectId={project.id}
							defaultLocaleId={project.defaultLocaleId}
							current={project.locales}
						/>
					}
				>
					<div className="flex flex-wrap gap-1.5">
						{project.locales.map((pl) => (
							<Badge
								key={pl.localeId}
								variant={
									pl.localeId === project.defaultLocaleId ? "info" : "outline"
								}
							>
								{pl.locale.code} — {pl.locale.name}
							</Badge>
						))}
					</div>
				</Section>

				<Section title="Entities" count={project.entities.length}>
					{project.entities.length === 0 ? (
						<EmptyState>No entities.</EmptyState>
					) : (
						<Card>
							<ul className="divide-y divide-zinc-100">
								{project.entities.map((e) => (
									<li
										key={e.id}
										className="flex items-center justify-between px-4 py-3"
									>
										<span className="font-mono text-sm font-medium text-zinc-900">
											{e.name}
										</span>
										<span className="text-xs text-zinc-500">
											{e._count.attributes} attrs · {e._count.records}{" "}
											records · v{e.currentVersion}
										</span>
									</li>
								))}
							</ul>
						</Card>
					)}
				</Section>

				<Section title="Screens" count={project.screens.length}>
					{project.screens.length === 0 ? (
						<EmptyState>No screens.</EmptyState>
					) : (
						<Card>
							<ul className="divide-y divide-zinc-100">
								{project.screens.map((s) => (
									<li key={s.id}>
										<Link
											href={`/projects/${project.id}/screens/${s.id}`}
											className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50"
										>
											<span className="font-mono text-sm text-zinc-900">
												{s.path}
											</span>
											<span className="flex items-center gap-3 text-xs text-zinc-500">
												{s._count.components} components · v
												{s.currentVersion}
												<ChevronRight className="h-4 w-4 text-zinc-400" />
											</span>
										</Link>
									</li>
								))}
							</ul>
						</Card>
					)}
				</Section>
			</div>
		</div>
	);
}

function SetupRow({
	icon,
	label,
	value,
}: {
	icon?: React.ReactNode;
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between px-4 py-3">
			<span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-500">
				{icon}
				{label}
			</span>
			<span>{value}</span>
		</div>
	);
}

function Section({
	title,
	count,
	action,
	children,
}: {
	title: string;
	count?: number;
	action?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section>
			<div className="mb-3 flex items-baseline justify-between">
				<h2 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
					{title}
					{typeof count === "number" && (
						<span className="text-zinc-400 normal-case">({count})</span>
					)}
				</h2>
				{action}
			</div>
			{children}
		</section>
	);
}
