import type { HTMLAttributes } from "react";

type Variant = "create" | "update" | "delete" | "neutral";

const variants: Record<Variant, string> = {
	create: "bg-emerald-400/20 text-emerald-200",
	update: "bg-sky-400/20 text-sky-200",
	delete: "bg-rose-400/20 text-rose-200",
	neutral: "bg-white/10 text-white/70",
};

type Props = HTMLAttributes<HTMLSpanElement> & { variant?: Variant };

export function Badge({ variant = "neutral", className = "", ...rest }: Props) {
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${variants[variant]} ${className}`}
			{...rest}
		/>
	);
}
