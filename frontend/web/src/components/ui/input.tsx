import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({
	className,
	...rest
}: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			className={cn(
				"flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...rest}
		/>
	);
}

export function Label({
	className,
	...rest
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
	return (
		<label
			className={cn(
				"text-xs font-medium text-zinc-700",
				className,
			)}
			{...rest}
		/>
	);
}
