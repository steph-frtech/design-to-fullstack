import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"rounded-lg border border-zinc-200 bg-white shadow-sm",
				className,
			)}
			{...rest}
		/>
	);
}

export function CardHeader({
	className,
	...rest
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("p-6", className)} {...rest} />;
}

export function CardContent({
	className,
	...rest
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("p-6 pt-0", className)} {...rest} />;
}

export function CardTitle({
	className,
	...rest
}: HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h3
			className={cn("text-base font-semibold text-zinc-900", className)}
			{...rest}
		/>
	);
}

export function CardDescription({
	className,
	...rest
}: HTMLAttributes<HTMLParagraphElement>) {
	return <p className={cn("text-sm text-zinc-500", className)} {...rest} />;
}
