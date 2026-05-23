"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
	{ href: "/", label: "Projects", match: (p: string) => p === "/" || p.startsWith("/projects") },
	{ href: "/routes", label: "Routes", match: (p: string) => p.startsWith("/routes") },
];

export function TopNav() {
	const pathname = usePathname();
	return (
		<header className="sticky top-0 z-10 border-b border-white/10 bg-white/5 backdrop-blur">
			<div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
				<Link href="/" className="font-mono text-sm font-semibold tracking-tight">
					<span className="text-white">design</span>
					<span className="text-[hsl(280,100%,70%)]">→</span>
					<span className="text-white">fullstack</span>
				</Link>
				<nav className="flex items-center gap-1">
					{items.map((item) => {
						const active = item.match(pathname ?? "");
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`rounded-full px-4 py-1.5 text-sm transition ${
									active
										? "bg-white/10 text-white"
										: "text-white/60 hover:text-white"
								}`}
							>
								{item.label}
							</Link>
						);
					})}
				</nav>
			</div>
		</header>
	);
}
