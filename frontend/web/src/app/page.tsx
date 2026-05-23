"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function Home() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["hello"],
		queryFn: async () => {
			const res = await api.api.hello.$get({
				query: { name: "design-to-fullstack" },
			});
			return await res.json();
		},
	});

	return (
		<main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
			<h1 className="text-4xl font-semibold">design-to-fullstack</h1>
			<p className="text-zinc-500">Hono RPC + Next 16 + Tailwind v4.</p>
			<div className="rounded-lg border border-zinc-200 px-4 py-3 font-mono text-sm dark:border-zinc-800">
				{isLoading && "loading…"}
				{error && `error: ${error.message}`}
				{data && data.greeting}
			</div>
		</main>
	);
}
