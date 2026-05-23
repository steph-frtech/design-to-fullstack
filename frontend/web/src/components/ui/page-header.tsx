import { ChevronLeft } from "lucide-react";
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
		<header className="mb-6 flex items-start justify-between gap-4">
			<div className="min-w-0">
				{back && (
					<Link
						href={back.href}
						className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
					>
						<ChevronLeft className="h-3.5 w-3.5" />
						{back.label ?? "Back"}
					</Link>
				)}
				<h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
					{title}
				</h1>
				{subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
			</div>
			{actions && (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			)}
		</header>
	);
}
