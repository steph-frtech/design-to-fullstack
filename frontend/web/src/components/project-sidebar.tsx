"use client";

import { useQuery } from "@tanstack/react-query";
import {
	ChevronLeft,
	Database,
	Languages,
	LayoutDashboard,
	MonitorPlay,
	Network,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

type Item = {
	href: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
	exact?: boolean;
};

export function ProjectSidebar({ projectId }: { projectId: string }) {
	const pathname = usePathname() ?? "";
	const base = `/projects/${projectId}`;
	const items: Item[] = [
		{ href: base, label: "Overview", icon: LayoutDashboard, exact: true },
		{ href: `${base}/screens`, label: "Screens", icon: MonitorPlay },
		{ href: `${base}/entities`, label: "Entities", icon: Database },
		{ href: `${base}/translations`, label: "Translations", icon: Languages },
		{ href: `${base}/routes`, label: "Routes", icon: Network },
	];

	const { data } = useQuery({
		queryKey: ["project", projectId],
		queryFn: async () => {
			const res = await api.api.projects[":id"].$get({
				param: { id: projectId },
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});

	const slug = data && "project" in data ? data.project.slug : "…";

	return (
		<aside className="flex h-screen w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
			<div className="border-b border-zinc-200 px-4 py-4">
				<Link
					href="/"
					className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-900"
				>
					<ChevronLeft className="h-3 w-3" />
					All projects
				</Link>
				<div className="mt-2 truncate text-sm font-semibold text-zinc-900">
					{slug}
				</div>
			</div>
			<nav className="flex-1 px-3 py-3">
				<ul className="space-y-0.5">
					{items.map(({ href, label, icon: Icon, exact }) => {
						const active = exact
							? pathname === href
							: pathname === href || pathname.startsWith(`${href}/`);
						return (
							<li key={href}>
								<Link
									href={href}
									className={cn(
										"flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
										active
											? "bg-blue-50 text-blue-700"
											: "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
									)}
								>
									<Icon className="h-4 w-4" />
									{label}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>
		</aside>
	);
}
