"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { readApiError } from "@/lib/api-error";
import { LOCALES, localeName } from "@/lib/locales";

type ProjectLocaleRow = {
	localeId: string;
	locale: { id: string; code: string; name: string };
};

export function ManageLocalesDialog({
	projectId,
	defaultLocaleId,
	current,
}: {
	projectId: string;
	defaultLocaleId: string;
	current: ProjectLocaleRow[];
}) {
	const [open, setOpen] = useState(false);
	const [picked, setPicked] = useState<string>(
		LOCALES.find((l) => !current.some((c) => c.locale.code === l.code))?.code ??
			"en",
	);
	const queryClient = useQueryClient();

	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: ["project", projectId] });

	const add = useMutation({
		mutationFn: async () => {
			const res = await api.api.projects[":id"].locales.$post({
				param: { id: projectId },
				json: { localeCode: picked, localeName: localeName(picked) },
			});
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
		onSuccess: refresh,
	});

	const remove = useMutation({
		mutationFn: async (localeId: string) => {
			const res = await api.api.projects[":id"].locales[":localeId"].$delete({
				param: { id: projectId, localeId },
			});
			if (!res.ok) throw new Error(await readApiError(res));
			return res.json();
		},
		onSuccess: refresh,
	});

	function submitAdd(e: FormEvent) {
		e.preventDefault();
		add.mutate();
	}

	const availableToAdd = LOCALES.filter(
		(l) => !current.some((c) => c.locale.code === l.code),
	);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Settings className="h-3.5 w-3.5" />
					Manage
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Project locales</DialogTitle>
					<DialogDescription>
						Choose which languages this project supports. The default locale
						can't be removed.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
						{current.map((row) => {
							const isDefault = row.localeId === defaultLocaleId;
							return (
								<li
									key={row.localeId}
									className="flex items-center justify-between px-3 py-2"
								>
									<div className="text-sm">
										<span className="font-mono text-zinc-700">
											{row.locale.code}
										</span>
										<span className="ml-2 text-zinc-500">
											{row.locale.name}
										</span>
										{isDefault && (
											<Badge variant="info" className="ml-2">
												Default
											</Badge>
										)}
									</div>
									<Button
										variant="ghost"
										size="sm"
										disabled={isDefault || remove.isPending}
										onClick={() => remove.mutate(row.localeId)}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</li>
							);
						})}
					</ul>

					{availableToAdd.length > 0 && (
						<form onSubmit={submitAdd} className="space-y-1.5">
							<Label>Add a language</Label>
							<div className="flex items-center gap-2">
								<Select
									value={picked}
									onChange={(e) => setPicked(e.target.value)}
									className="flex-1"
								>
									{availableToAdd.map((l) => (
										<option key={l.code} value={l.code}>
											{l.name} ({l.code})
										</option>
									))}
								</Select>
								<Button type="submit" size="sm" disabled={add.isPending}>
									<Plus className="h-3.5 w-3.5" />
									Add
								</Button>
							</div>
						</form>
					)}

					{(add.error || remove.error) && (
						<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
							{((add.error ?? remove.error) as Error).message ===
							"cannot_remove_default_locale"
								? "You can't remove the default locale. Change it first."
								: ((add.error ?? remove.error) as Error).message}
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
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
