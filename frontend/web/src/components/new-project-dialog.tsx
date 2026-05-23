"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { readApiError } from "@/lib/api-error";
import { LOCALES, localeName } from "@/lib/locales";

export function NewProjectDialog() {
	const [open, setOpen] = useState(false);
	const [slug, setSlug] = useState("");
	const [defaultLocale, setDefaultLocale] = useState<string>("en");
	const [extras, setExtras] = useState<Set<string>>(new Set());
	const queryClient = useQueryClient();
	const router = useRouter();

	function toggleExtra(code: string) {
		setExtras((prev) => {
			const next = new Set(prev);
			if (next.has(code)) next.delete(code);
			else next.add(code);
			return next;
		});
	}

	const create = useMutation({
		mutationFn: async () => {
			const res = await api.api.projects.$post({
				json: {
					slug,
					localeCode: defaultLocale,
					localeName: localeName(defaultLocale),
					extraLocales: Array.from(extras).map((code) => ({
						code,
						name: localeName(code),
					})),
				},
			});
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
			setOpen(false);
			setSlug("");
			setExtras(new Set());
			if ("project" in data) router.push(`/projects/${data.project.id}`);
		},
	});

	function submit(e: FormEvent) {
		e.preventDefault();
		if (!slug) return;
		create.mutate();
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm">
					<Plus className="h-3.5 w-3.5" />
					New project
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={submit}>
					<DialogHeader>
						<DialogTitle>New project</DialogTitle>
						<DialogDescription>
							A project is one app you're building from a design.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="slug">Slug</Label>
							<Input
								id="slug"
								autoFocus
								placeholder="my-app"
								value={slug}
								onChange={(e) =>
									setSlug(
										e.target.value
											.toLowerCase()
											.replace(/[^a-z0-9-]/g, "-")
											.replace(/-+/g, "-")
											.replace(/^-|-$/g, ""),
									)
								}
								pattern="^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
								required
							/>
							<p className="text-xs text-zinc-500">
								Lowercase letters, digits and hyphens.
							</p>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="default-locale">Default language</Label>
							<Select
								id="default-locale"
								value={defaultLocale}
								onChange={(e) => {
									setDefaultLocale(e.target.value);
									// remove from extras if it was selected there
									setExtras((prev) => {
										const next = new Set(prev);
										next.delete(e.target.value);
										return next;
									});
								}}
							>
								{LOCALES.map((l) => (
									<option key={l.code} value={l.code}>
										{l.name} ({l.code})
									</option>
								))}
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label>Other supported languages</Label>
							<div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md border border-zinc-200 p-3">
								{LOCALES.filter((l) => l.code !== defaultLocale).map((l) => (
									<label
										key={l.code}
										className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700"
									>
										<input
											type="checkbox"
											checked={extras.has(l.code)}
											onChange={() => toggleExtra(l.code)}
											className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
										/>
										<span>
											{l.name}{" "}
											<span className="text-zinc-400">({l.code})</span>
										</span>
									</label>
								))}
							</div>
							<p className="text-xs text-zinc-500">
								You can add or remove languages later.
							</p>
						</div>

						{create.error && (
							<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
								{translateError((create.error as Error).message)}
							</div>
						)}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={!slug || create.isPending}>
							{create.isPending ? "Creating…" : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function translateError(msg: string): string {
	if (msg === "slug_taken") return "This slug is already taken.";
	if (msg === "validation_failed") return "Some fields are invalid.";
	return msg;
}
