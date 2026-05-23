"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
	className,
	children,
	...rest
}: ComponentProps<typeof DialogPrimitive.Content>) {
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
			<DialogPrimitive.Content
				className={cn(
					"fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-6 shadow-lg focus:outline-none",
					className,
				)}
				{...rest}
			>
				{children}
				<DialogPrimitive.Close className="absolute right-4 top-4 rounded-md text-zinc-400 transition-colors hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
					<X className="h-4 w-4" />
					<span className="sr-only">Close</span>
				</DialogPrimitive.Close>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	);
}

export function DialogHeader({
	className,
	...rest
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("mb-4 space-y-1", className)} {...rest} />;
}

export function DialogFooter({
	className,
	...rest
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("mt-6 flex items-center justify-end gap-2", className)}
			{...rest}
		/>
	);
}

export function DialogTitle({
	className,
	...rest
}: ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			className={cn("text-base font-semibold text-zinc-900", className)}
			{...rest}
		/>
	);
}

export function DialogDescription({
	className,
	...rest
}: ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			className={cn("text-sm text-zinc-500", className)}
			{...rest}
		/>
	);
}
