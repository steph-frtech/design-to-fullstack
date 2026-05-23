import Visualizer from "next-route-visualizer";
import "reactflow/dist/style.css";

export const dynamic = "force-dynamic";

export default function RoutesPage() {
	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold">Routes</h1>
				<p className="text-sm text-zinc-500">
					Visual map of the Next.js app directory routes. Click a node to inspect.
				</p>
			</div>
			<div
				className="rounded border border-zinc-200 dark:border-zinc-800"
				style={{ height: "calc(100vh - 220px)" }}
			>
				<Visualizer />
			</div>
		</div>
	);
}
