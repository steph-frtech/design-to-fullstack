import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
	title: ReactNode;
	subtitle?: ReactNode;
	back?: { href: string; label?: string };
	actions?: ReactNode;
};

export function PageHeader({ title, subtitle, back, actions }: Props) {
	return (
		<header className="mb-8 flex items-start justify-between gap-4">
			<div>
				{back && (
					<Link
						href={back.href}
						className="text-sm text-white/50 transition hover:text-white"
					>
						← {back.label ?? "Back"}
					</Link>
				)}
				<h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
				{subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</header>
	);
}
