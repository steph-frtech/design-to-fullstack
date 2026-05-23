import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const badge = cva(
	"inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
	{
		variants: {
			variant: {
				default: "bg-zinc-100 text-zinc-700",
				outline: "border border-zinc-200 text-zinc-700",
				success: "bg-emerald-100 text-emerald-800",
				warn: "bg-amber-100 text-amber-800",
				danger: "bg-red-100 text-red-800",
				info: "bg-sky-100 text-sky-800",
				mono: "bg-zinc-100 text-zinc-700 font-mono normal-case tracking-normal",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

type Props = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>;

export function Badge({ className, variant, ...rest }: Props) {
	return <span className={cn(badge({ variant }), className)} {...rest} />;
}
