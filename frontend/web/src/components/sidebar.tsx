"use client";

import { FolderKanban, Network } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { cn } from "@/lib/cn";

type Item = {
	href: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
	match: (p: string) => boolean;
};

const items: Item[] = [
	{
		href: "/",
		label: "Projects",
		icon: FolderKanban,
		match: (p) => p === "/" || p.startsWith("/projects"),
	},
	{
		href: "/routes",
		label: "Routes",
		icon: Network,
		match: (p) => p.startsWith("/routes"),
	},
];

export function Sidebar() {
	const pathname = usePathname() ?? "";
	return (
		<aside className="flex h-screen w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
			<div className="px-5 py-5">
				<Link href="/" className="flex items-center gap-1.5">
					<span className="font-mono text-[13px] font-semibold tracking-tight text-zinc-900">
						design
					</span>
					<span className="text-blue-600">→</span>
					<span className="font-mono text-[13px] font-semibold tracking-tight text-zinc-900">
						fullstack
					</span>
				</Link>
			</div>
			<nav className="flex-1 px-3">
				<ul className="space-y-0.5">
					{items.map(({ href, label, icon: Icon, match }) => {
						const active = match(pathname);
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
			<div className="px-3 py-4">
				<p className="text-[11px] text-zinc-400">
					DTFS · {process.env.NEXT_PUBLIC_BACKEND_URL ?? ""}
				</p>
			</div>
		</aside>
	);
}
