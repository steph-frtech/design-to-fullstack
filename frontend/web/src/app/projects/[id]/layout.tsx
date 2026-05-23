import { ProjectSidebar } from "@/components/project-sidebar";

export default async function ProjectLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return (
		<div className="flex h-screen w-screen overflow-hidden">
			<ProjectSidebar projectId={id} />
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
				<main className="flex-1 overflow-auto">
					<div className="mx-auto w-full max-w-7xl px-8 py-8">{children}</div>
				</main>
			</div>
		</div>
	);
}
