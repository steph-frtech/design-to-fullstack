import Visualizer from "next-route-visualizer";
import "reactflow/dist/style.css";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default function RoutesPage() {
	return (
		<div>
			<PageHeader
				title="Routes"
				subtitle="Visual map of the Next.js app directory. Click a node to inspect."
			/>
			<div
				className="overflow-hidden rounded-xl border border-white/10 bg-white/5"
				style={{ height: "calc(100vh - 240px)" }}
			>
				<Visualizer />
			</div>
		</div>
	);
}
