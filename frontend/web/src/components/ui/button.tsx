import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const button = cva(
	"inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				default: "bg-blue-600 text-white hover:bg-blue-700",
				outline:
					"border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
				ghost: "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
				destructive: "bg-red-600 text-white hover:bg-red-700",
				secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
			},
			size: {
				sm: "h-7 px-2.5 text-xs",
				default: "h-9 px-4 text-sm",
				lg: "h-10 px-6 text-sm",
				icon: "h-9 w-9",
			},
		},
		defaultVariants: { variant: "default", size: "default" },
	},
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export function Button({ className, variant, size, ...rest }: Props) {
	return (
		<button
			type={rest.type ?? "button"}
			className={cn(button({ variant, size }), className)}
			{...rest}
		/>
	);
}
