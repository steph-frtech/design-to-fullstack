import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Select({
	className,
	children,
	...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select
			className={cn(
				"flex h-9 w-full appearance-none rounded-md border border-zinc-200 bg-white bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2371717a%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px_12px] bg-[position:right_0.5rem_center] bg-no-repeat px-3 py-1 pr-8 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...rest}
		>
			{children}
		</select>
	);
}
