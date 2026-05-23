import Visualizer from "next-route-visualizer";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default function RoutesPage() {
	return (
		<div>
			<PageHeader
				title="Routes"
				subtitle="Visual map of the Next.js app directory. Click a node to inspect."
			/>
			<Card
				className="overflow-hidden"
				style={{ height: "calc(100vh - 220px)" }}
			>
				<Visualizer />
			</Card>
		</div>
	);
}
