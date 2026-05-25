// emit-next.ts — generates Next.js App Router pages + component stubs.
// One page per Screen, simple component stubs from Screen.components.
// Supports both legacy spec-based and contract-driven generation.

import type { CodegenSpec, GeneratedFile } from "./types.ts";
import type { FrontendContractObj } from "../lib/contracts/compile-frontend";

function screenPathToNextPath(screenPath: string): string {
	// Turn "/contact" → "app/contact/page.tsx"
	// Turn "/" → "app/page.tsx"
	const clean = screenPath.replace(/^\//, "");
	if (!clean) return "app/page.tsx";
	return `app/${clean}/page.tsx`;
}

function toPascalCase(name: string): string {
	// "/" → "Home", "/contact" → "Contact", "/admin/users" → "AdminUsers"
	const segments = name
		.split("/")
		.filter(Boolean)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
	if (segments.length === 0) return "Home";
	return segments.join("");
}

function componentKindToJsx(type: string, config: unknown): string {
	const cfg = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
	const label = typeof cfg["label"] === "string" ? cfg["label"] : type;

	switch (type) {
		case "form":
			return `<form className="flex flex-col gap-4">\n        {/* form fields */}\n        <button type="submit">Submit</button>\n      </form>`;
		case "table":
			return `<table className="w-full border-collapse">\n        <thead><tr><th>—</th></tr></thead>\n        <tbody><tr><td>—</td></tr></tbody>\n      </table>`;
		case "text":
			return `<p>{/* ${label} */}</p>`;
		case "image":
			return `{/* eslint-disable-next-line @next/next/no-img-element */}\n      <img src="" alt="${label}" />`;
		case "container":
		case "row":
		case "col":
			return `<div className="${type}">{/* ${label} */}</div>`;
		default:
			return `<div data-kind="${type}">{/* ${label} */}</div>`;
	}
}

/**
 * Emit one Next.js page file per Screen, plus a shared layout.tsx.
 */
export function emitNextPages(spec: CodegenSpec): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	// Sort screens by path for determinism
	const sorted = [...spec.screens].sort((a, b) => a.path.localeCompare(b.path));

	for (const screen of sorted) {
		const nextPath = `frontend/src/${screenPathToNextPath(screen.path)}`;
		const componentName = `${toPascalCase(screen.path)}Page`;
		const content = emitPageFile(screen, componentName);
		files.push({ path: nextPath, kind: "CODE", content });
	}

	// Root layout
	files.push({
		path: "frontend/src/app/layout.tsx",
		kind: "CODE",
		content: emitRootLayout(spec.project.slug),
	});

	return files;
}

function emitPageFile(
	screen: CodegenSpec["screens"][number],
	componentName: string,
): string {
	const lines: string[] = [];
	lines.push(`// Auto-generated page: ${screen.path}`);
	lines.push(`// Regenerate via: dtfs__generate_app`);
	lines.push(``);
	lines.push(`export default function ${componentName}() {`);
	lines.push(`  return (`);
	lines.push(`    <main className="p-6">`);
	lines.push(`      <h1 className="text-2xl font-bold mb-4">${screen.path}</h1>`);

	// Emit component stubs
	const sorted = [...screen.components].sort((a, b) => a.type.localeCompare(b.type));
	for (const comp of sorted) {
		const jsx = componentKindToJsx(comp.type, comp.config);
		lines.push(`      {/* Component: ${comp.type} */}`);
		lines.push(`      ${jsx}`);
	}

	if (screen.components.length === 0) {
		lines.push(`      {/* No components defined yet */}`);
	}

	lines.push(`    </main>`);
	lines.push(`  );`);
	lines.push(`}`);
	lines.push(``);
	return lines.join("\n");
}

function emitRootLayout(projectSlug: string): string {
	return `// Auto-generated root layout — project: ${projectSlug}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "${projectSlug}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

// ─── Contract-driven frontend emission ───────────────────────────────────────

/**
 * Emit Next.js frontend files from a FrontendContractObj.
 * Target: apps/web/{app/, components/generated/, lib/}
 */
export function emitNextFrontend(contract: FrontendContractObj): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	// ── app/ pages ────────────────────────────────────────────────────────────
	for (const page of contract.pages) {
		const nextPath = page.nextRoute ? `apps/web/app/${page.nextRoute}/page.tsx` : "apps/web/app/page.tsx";
		// Clean up path for root
		const cleanPath = nextPath.replace("//", "/").replace("/page.tsx/page.tsx", "/page.tsx");
		files.push({
			path: cleanPath,
			kind: "CODE",
			content: emitContractPage(page, contract.forms),
		});
	}

	// ── layouts ───────────────────────────────────────────────────────────────
	for (const layout of contract.layouts) {
		files.push({
			path: `apps/web/${layout.path}`,
			kind: "CODE",
			content: emitContractLayout(layout.name),
		});
	}

	// ── components/generated/ — one per generated component type ─────────────
	const componentTypes = [...new Set(contract.components.map((c) => c.type))];
	for (const type of componentTypes) {
		const pascalType = type.charAt(0).toUpperCase() + type.slice(1);
		files.push({
			path: `apps/web/components/generated/${pascalType}.tsx`,
			kind: "CODE",
			content: emitContractComponent(type, pascalType),
		});
	}

	// ── lib/api/client.ts — typed API client ──────────────────────────────────
	files.push({
		path: "apps/web/lib/api/client.ts",
		kind: "CODE",
		content: emitApiClient(),
	});

	// ── lib/schemas/index.ts — re-export from shared ──────────────────────────
	files.push({
		path: "apps/web/lib/schemas/index.ts",
		kind: "CODE",
		content: `// Re-export shared schemas\nexport * from "@repo/shared/schemas/index";\n`,
	});

	// ── lib/auth/client.ts — Better Auth client stub ──────────────────────────
	files.push({
		path: "apps/web/lib/auth/client.ts",
		kind: "CODE",
		content: emitAuthClient(contract.authGuards),
	});

	return files;
}

type PageEntry = FrontendContractObj["pages"][number];
type FormEntry = FrontendContractObj["forms"][number];

function emitContractPage(page: PageEntry, forms: FormEntry[]): string {
	const componentName = routeToComponentName(page.nextRoute || page.path);
	const pageForms = forms.filter((f) => {
		// Forms associated with this page's components
		return true; // We can't precisely filter without screenId → componentId join, emit all
	});
	void pageForms; // future use

	const lines: string[] = [];
	lines.push(`// Auto-generated page: ${page.path} (contract-driven)`);
	lines.push(`// Regenerate via: dtfs__generate_frontend_next`);
	lines.push(``);
	if (page.titleKey) {
		lines.push(`// Title key: ${page.titleKey}`);
	}
	lines.push(`export default function ${componentName}Page() {`);
	lines.push(`  return (`);
	lines.push(`    <main className="p-6">`);
	lines.push(`      <h1 className="text-2xl font-bold mb-4">${page.path}</h1>`);
	lines.push(`      {/* ${page.componentCount} component(s) — wire up data bindings + forms */}`);
	lines.push(`    </main>`);
	lines.push(`  );`);
	lines.push(`}`);
	lines.push(``);
	return lines.join("\n");
}

function routeToComponentName(route: string): string {
	if (!route) return "Home";
	return route
		.split("/")
		.filter(Boolean)
		.map((s) => {
			// [id] → Id, otherwise PascalCase
			const clean = s.replace(/\[([^\]]+)\]/, (_, k) => k.charAt(0).toUpperCase() + k.slice(1));
			return clean.charAt(0).toUpperCase() + clean.slice(1);
		})
		.join("");
}

function emitContractLayout(layoutName: string): string {
	return `// Auto-generated layout: ${layoutName}
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "${layoutName}",
};

export default function ${layoutName}({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

function emitContractComponent(type: string, pascalType: string): string {
	return `// Auto-generated component stub: ${type} (contract-driven)
export function ${pascalType}({ className }: { className?: string }) {
  return (
    <div className={className} data-component="${type}">
      {/* TODO: implement ${type} component */}
    </div>
  );
}
`;
}

function emitApiClient(): string {
	return `// Auto-generated API client (contract-driven)
// Uses fetch with typed operations from @repo/shared

export async function apiCall<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";
  const res = await fetch(\`\${base}\${path}\`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(\`API error \${res.status}: \${await res.text()}\`);
  }
  return res.json() as Promise<T>;
}
`;
}

function emitAuthClient(guards: FrontendContractObj["authGuards"]): string {
	const guardNames = guards.map((g) => `  // - ${g.policyName} (${g.scope})`).join("\n");
	return `// Auto-generated Better Auth client stub (contract-driven)
// Active auth guards:
${guardNames || "  // none"}

// TODO: configure better-auth client
export const authClient = {
  signIn: async (_email: string, _password: string) => { throw new Error("not implemented"); },
  signOut: async () => { throw new Error("not implemented"); },
  getSession: async () => null as null | { userId: string; email: string },
};
`;
}
