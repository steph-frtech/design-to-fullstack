import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type FieldStatusKind = "idle" | "loading" | "ok" | "warn" | "error";

const ICON: Record<Exclude<FieldStatusKind, "idle">, typeof Check> = {
	loading: Loader2,
	ok: Check,
	warn: AlertTriangle,
	error: X,
};

const TONE: Record<Exclude<FieldStatusKind, "idle">, string> = {
	loading: "text-zinc-400",
	ok: "text-emerald-600",
	warn: "text-amber-600",
	error: "text-red-600",
};

export function FieldStatusIcon({ kind }: { kind: FieldStatusKind }) {
	if (kind === "idle") return null;
	const Icon = ICON[kind];
	return (
		<Icon
			className={cn(
				"h-4 w-4 shrink-0",
				TONE[kind],
				kind === "loading" && "animate-spin",
			)}
		/>
	);
}

export function FieldMessage({
	kind,
	children,
}: {
	kind: FieldStatusKind;
	children: ReactNode;
}) {
	if (kind === "idle" || !children) return null;
	return (
		<p
			className={cn(
				"text-xs",
				kind === "ok" && "text-emerald-700",
				kind === "warn" && "text-amber-700",
				kind === "error" && "text-red-700",
				kind === "loading" && "text-zinc-500",
			)}
		>
			{children}
		</p>
	);
}
