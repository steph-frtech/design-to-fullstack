import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
	action?: ReactNode;
};

export function EmptyState({ children, action }: Props) {
	return (
		<div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/60">
			<div>{children}</div>
			{action && <div className="mt-4">{action}</div>}
		</div>
	);
}
