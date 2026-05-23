import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
	children: ReactNode;
	action?: ReactNode;
	className?: string;
};

export function EmptyState({ children, action, className }: Props) {
	return (
		<div
			className={cn(
				"rounded-lg border border-dashed border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500",
				className,
			)}
		>
			<div>{children}</div>
			{action && <div className="mt-4 flex justify-center">{action}</div>}
		</div>
	);
}
