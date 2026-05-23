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
import { api } from "@/lib/api";

export function NewProjectDialog() {
	const [open, setOpen] = useState(false);
	const [slug, setSlug] = useState("");
	const [localeCode, setLocaleCode] = useState("en");
	const queryClient = useQueryClient();
	const router = useRouter();

	const create = useMutation({
		mutationFn: async () => {
			const res = await api.api.projects.$post({
				json: {
					slug,
					localeCode,
					localeName: localeCode === "fr" ? "Français" : "English",
				},
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				throw new Error(body.error ?? `HTTP ${res.status}`);
			}
			return res.json();
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
			setOpen(false);
			setSlug("");
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
											.replace(/-+/g, "-"),
									)
								}
								pattern="^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
								required
							/>
							<p className="text-xs text-zinc-500">
								Lowercase letters, digits and hyphens. Used as the project URL
								identifier.
							</p>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="locale">Default locale</Label>
							<Input
								id="locale"
								value={localeCode}
								onChange={(e) => setLocaleCode(e.target.value)}
								placeholder="en"
								maxLength={10}
							/>
						</div>

						{create.error && (
							<p className="text-sm text-red-600">
								{(create.error as Error).message === "slug_taken"
									? "This slug is already taken."
									: (create.error as Error).message}
							</p>
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
						<Button
							type="submit"
							size="sm"
							disabled={!slug || create.isPending}
						>
							{create.isPending ? "Creating…" : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
