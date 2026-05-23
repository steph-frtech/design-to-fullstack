import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
	primary:
		"bg-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,62%)] text-white",
	secondary: "bg-white/10 hover:bg-white/20 text-white",
	ghost: "text-white/70 hover:text-white hover:bg-white/5",
};

const sizes: Record<Size, string> = {
	sm: "px-3 py-1 text-xs",
	md: "px-5 py-2 text-sm",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: Variant;
	size?: Size;
};

export function Button({
	variant = "primary",
	size = "md",
	className = "",
	...rest
}: ButtonProps) {
	return (
		<button
			type={rest.type ?? "button"}
			className={`inline-flex items-center justify-center rounded-full font-medium transition focus:outline-none focus:ring-2 focus:ring-[hsl(280,100%,70%)]/60 disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
			{...rest}
		/>
	);
}
