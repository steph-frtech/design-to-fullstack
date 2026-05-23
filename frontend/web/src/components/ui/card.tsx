import type { HTMLAttributes } from "react";

export function Card({
	className = "",
	...rest
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={`rounded-xl bg-white/10 p-6 transition hover:bg-white/15 ${className}`}
			{...rest}
		/>
	);
}

export function CardTitle({
	className = "",
	...rest
}: HTMLAttributes<HTMLHeadingElement>) {
	return <h3 className={`text-lg font-semibold ${className}`} {...rest} />;
}

export function CardMeta({
	className = "",
	...rest
}: HTMLAttributes<HTMLParagraphElement>) {
	return <p className={`text-sm text-white/50 ${className}`} {...rest} />;
}
