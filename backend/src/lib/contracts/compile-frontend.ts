// compile-frontend.ts — Read-only compilation of the frontend contract.
// Reads Screen/Component/Form/Field/Action/DataBinding/Policy/Translation/Theme/Asset
// and returns a structured FrontendContractObj in memory. Nothing is persisted.

import { prisma } from "../../db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PageEntry = {
	screenId: string;
	path: string;
	nextRoute: string;
	type: string | null;
	titleKey: string | null;
	componentCount: number;
};

export type FormEntry = {
	formId: string;
	componentId: string;
	entityRef: string | null;
	operationRef: string | null;
	fields: {
		name: string;
		type: string;
		required: boolean;
		zodType: string;
	}[];
	onSuccess: unknown;
	onError: unknown;
};

export type DataBindingEntry = {
	bindingId: string;
	componentId: string | null;
	sourceKind: string;
	source: unknown;
	query: unknown;
};

export type ActionEntry = {
	actionId: string;
	componentId: string | null;
	kind: string;
	targetType: string;
	targetId: string | null;
};

export type AuthGuardEntry = {
	policyName: string;
	scope: string;
	effect: string;
};

export type FrontendContractObj = {
	routes: { path: string; nextRoute: string; screenId: string }[];
	pages: PageEntry[];
	layouts: { name: string; path: string }[];
	components: { componentId: string; type: string; screenId: string | null }[];
	forms: FormEntry[];
	dataBindings: DataBindingEntry[];
	actions: ActionEntry[];
	authGuards: AuthGuardEntry[];
	generatedFrom: {
		screens: number;
		components: number;
		forms: number;
		actions: number;
		dataBindings: number;
	};
};

// ─── FieldType → Zod string ───────────────────────────────────────────────────

function fieldTypeToZod(ft: string): string {
	const map: Record<string, string> = {
		TEXT: "z.string()",
		TEXTAREA: "z.string()",
		EMAIL: "z.string().email()",
		PASSWORD: "z.string().min(8)",
		NUMBER: "z.number()",
		DATE: "z.string()",
		DATETIME: "z.string()",
		TIME: "z.string()",
		CHECKBOX: "z.boolean()",
		RADIO: "z.string()",
		SELECT: "z.string()",
		MULTISELECT: "z.array(z.string())",
		FILE: "z.string()",
		RICHTEXT: "z.string()",
		COLOR: "z.string()",
		RANGE: "z.number()",
		HIDDEN: "z.string()",
		CUSTOM: "z.unknown()",
	};
	return map[ft] ?? "z.unknown()";
}

// ─── pathToNextRoute ──────────────────────────────────────────────────────────

function pathToNextRoute(path: string): string {
	// "/users/:id/profile" → "users/[id]/profile"
	return path
		.replace(/^\//, "")
		.replace(/:([a-zA-Z_]+)/g, "[$1]");
}

// ─── compileFrontendContract ──────────────────────────────────────────────────

export async function compileFrontendContract(projectId: string): Promise<FrontendContractObj> {
	const [screens, forms, dataBindings, actions, policies] = await Promise.all([
		prisma.screen.findMany({
			where: { projectId },
			include: { components: { include: { form: { include: { fields: true } } } } },
		}),
		prisma.form.findMany({
			where: { component: { screen: { projectId } } },
			include: { fields: true, entity: { select: { name: true } }, operation: { select: { name: true } } },
		}),
		// Select only base columns (phase_0 migration). sourceKind/componentFkId/expr/targetProp are phase_10.
		prisma.dataBinding.findMany({
			where: { projectId },
			select: { id: true, projectId: true, componentId: true, source: true, query: true, createdAt: true, updatedAt: true },
		}),
		// Select only base columns (phase_0 migration). name/actionKind/target/config are phase_10.
		prisma.action.findMany({
			where: { projectId },
			select: { id: true, projectId: true, componentId: true, kind: true, targetType: true, targetId: true, data: true },
		}),
		prisma.policy.findMany({ where: { projectId } }),
	]);

	// ── Pages + Routes ────────────────────────────────────────────────────────
	const pages: PageEntry[] = screens.map((screen) => ({
		screenId: screen.id,
		path: screen.path,
		nextRoute: pathToNextRoute(screen.path),
		type: screen.type,
		titleKey: screen.titleKey,
		componentCount: screen.components.length,
	}));

	const routes = screens.map((s) => ({
		path: s.path,
		nextRoute: pathToNextRoute(s.path),
		screenId: s.id,
	}));

	// ── Layouts (default root layout + per-type if multiple types exist) ──────
	const screenTypes = [...new Set(screens.map((s) => s.type).filter(Boolean))];
	const layouts = [
		{ name: "RootLayout", path: "app/layout.tsx" },
		...screenTypes.map((t) => ({
			name: `${String(t).charAt(0).toUpperCase() + String(t).slice(1)}Layout`,
			path: `app/(${t})/layout.tsx`,
		})),
	];

	// ── Components ────────────────────────────────────────────────────────────
	const allComponents = screens.flatMap((s) =>
		s.components.map((c) => ({
			componentId: c.id,
			type: c.type,
			screenId: c.screenId,
		})),
	);

	// ── Forms ─────────────────────────────────────────────────────────────────
	const compiledForms: FormEntry[] = forms.map((form) => ({
		formId: form.id,
		componentId: form.componentId,
		entityRef: form.entity?.name ?? null,
		operationRef: form.operation?.name ?? null,
		fields: form.fields.map((f) => ({
			name: f.name,
			type: f.type,
			required: f.required,
			zodType: fieldTypeToZod(f.type) + (f.required ? "" : ".optional()"),
		})),
		onSuccess: form.onSuccess,
		onError: form.onError,
	}));

	// ── DataBindings ──────────────────────────────────────────────────────────
	const compiledBindings: DataBindingEntry[] = dataBindings.map((db) => ({
		bindingId: db.id,
		componentId: db.componentId,
		sourceKind: typeof db.source === "object" && db.source !== null
			? ((db.source as Record<string, unknown>).kind as string | undefined) ?? "QUERY"
			: "QUERY",
		source: db.source,
		query: db.query,
	}));

	// ── Actions ───────────────────────────────────────────────────────────────
	// Use only the columns guaranteed to exist in the current migration (base schema).
	// actionKind/name/target/config are phase_10 additions that may not be migrated.
	const compiledActions: ActionEntry[] = actions.map((a) => ({
		actionId: a.id,
		componentId: a.componentId,
		kind: a.kind,
		targetType: a.targetType,
		targetId: a.targetId,
	}));

	// ── Auth Guards ───────────────────────────────────────────────────────────
	const authGuards: AuthGuardEntry[] = policies
		.filter((p) => p.scope === "RESOURCE" || p.scope === "OPERATION")
		.map((p) => ({
			policyName: p.name,
			scope: p.scope,
			effect: p.effect,
		}));

	return {
		routes,
		pages,
		layouts,
		components: allComponents,
		forms: compiledForms,
		dataBindings: compiledBindings,
		actions: compiledActions,
		authGuards,
		generatedFrom: {
			screens: screens.length,
			components: allComponents.length,
			forms: forms.length,
			actions: actions.length,
			dataBindings: dataBindings.length,
		},
	};
}
