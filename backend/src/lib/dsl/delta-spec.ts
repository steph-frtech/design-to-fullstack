// Canonical DeltaSpec format — the ONLY authorised format for modifying the
// Control Plane. Every agent must produce a DeltaSpec, validate it, then
// pass it to apply_spec which emits one ChangeSet.

import { z } from "zod";

// ─── Generic block ────────────────────────────────────────────────────────────

export type DeltaBlock<Create, Update, Ref> = {
	create?: Create[];
	update?: Update[];
	delete?: Ref[];
};

export const refSchema = z.object({ id: z.string() });

/** Generic block schema factory. Use `deltaSpecSchema` for full spec validation. */
export function deltaBlock<C extends z.ZodTypeAny, U extends z.ZodTypeAny>(
	createSchema: C,
	updateSchema: U,
) {
	return z
		.object({
			create: z.array(createSchema).optional(),
			update: z.array(updateSchema).optional(),
			delete: z.array(refSchema).optional(),
		})
		.optional();
}

// ─── ProductSpec ──────────────────────────────────────────────────────────────

export const productSpecInputSchema = z.object({
	title: z.string().min(1),
	description: z.string().min(1),
	domain: z.string().optional(),
	targetUsers: z.array(z.unknown()).default([]),
	goals: z.array(z.unknown()).default([]),
	nonGoals: z.array(z.unknown()).optional(),
	personas: z.array(z.unknown()).optional(),
	userJourneys: z.array(z.unknown()).optional(),
	businessObjects: z.array(z.unknown()).optional(),
	businessRules: z.array(z.unknown()).optional(),
	glossary: z.array(z.unknown()).optional(),
	assumptions: z.array(z.unknown()).optional(),
	openQuestions: z.array(z.unknown()).optional(),
});
export type ProductSpecInput = z.infer<typeof productSpecInputSchema>;
export type ProductSpecPatch = Partial<ProductSpecInput> & { id: string };
export type ProductSpecRef = { id: string };
const productSpecPatchSchema = productSpecInputSchema.partial().extend({ id: z.string() });

// ─── ScreenSpec ───────────────────────────────────────────────────────────────

export const screenSpecInputSchema = z.object({
	name: z.string().min(1),
	description: z.string().min(1),
	productSpecId: z.string().optional(),
	actor: z.string().optional(),
	purpose: z.string().optional(),
	userIntent: z.string().optional(),
	layoutHint: z.string().optional(),
	components: z.array(z.unknown()).optional(),
	fields: z.array(z.unknown()).optional(),
	actions: z.array(z.unknown()).optional(),
	dataNeeds: z.array(z.unknown()).optional(),
	businessRules: z.array(z.unknown()).optional(),
	emptyStates: z.array(z.unknown()).optional(),
	errorStates: z.array(z.unknown()).optional(),
	assumptions: z.array(z.unknown()).optional(),
	openQuestions: z.array(z.unknown()).optional(),
});
export type ScreenSpecInput = z.infer<typeof screenSpecInputSchema>;
export type ScreenSpecPatch = Partial<ScreenSpecInput> & { id: string };
export type ScreenSpecRef = { id: string };
const screenSpecPatchSchema = screenSpecInputSchema.partial().extend({ id: z.string() });

// ─── Requirement ─────────────────────────────────────────────────────────────

export const requirementInputSchema = z.object({
	key: z.string().min(1),
	title: z.string().min(1),
	description: z.string().min(1),
	priority: z.string().optional(),
	status: z.string().optional(),
	acceptanceCriteria: z.array(z.unknown()).optional(),
	source: z.string().optional(),
	productSpecId: z.string().optional(),
});
export type RequirementInput = z.infer<typeof requirementInputSchema>;
export type RequirementPatch = Partial<RequirementInput> & { id: string };
export type RequirementRef = { id: string };
const requirementPatchSchema = requirementInputSchema.partial().extend({ id: z.string() });

// ─── Entity ───────────────────────────────────────────────────────────────────

export const entityInputSchema = z.object({
	name: z.string().min(1),
	nameKey: z.string().optional(),
});
export type EntityInput = z.infer<typeof entityInputSchema>;
export type EntityPatch = Partial<EntityInput> & { id: string };
export type EntityRef = { id: string };
const entityPatchSchema = entityInputSchema.partial().extend({ id: z.string() });

// ─── Attribute ────────────────────────────────────────────────────────────────

export const attributeInputSchema = z.object({
	// Reference by name (resolved at apply time) or id
	entityName: z.string().optional(),
	entityId: z.string().optional(),
	name: z.string().min(1),
	type: z.string().min(1), // FieldType enum value
	required: z.boolean().optional(),
	unique: z.boolean().optional(),
	config: z.record(z.unknown()).optional(),
});
export type AttributeInput = z.infer<typeof attributeInputSchema>;
export type AttributePatch = Partial<AttributeInput> & { id: string };
export type AttributeRef = { id: string };
const attributePatchSchema = attributeInputSchema.partial().extend({ id: z.string() });

// ─── EntityRelation ───────────────────────────────────────────────────────────

export const relationInputSchema = z.object({
	fromEntityName: z.string().optional(),
	fromEntityId: z.string().optional(),
	toEntityName: z.string().optional(),
	toEntityId: z.string().optional(),
	name: z.string().min(1),
	kind: z.enum(["ONE_TO_ONE", "ONE_TO_MANY", "MANY_TO_MANY"]),
	fromField: z.string().optional(),
	toField: z.string().optional(),
	required: z.boolean().optional(),
	cascade: z.record(z.unknown()).optional(),
});
export type RelationInput = z.infer<typeof relationInputSchema>;
export type RelationPatch = Partial<RelationInput> & { id: string };
export type RelationRef = { id: string };
const relationPatchSchema = relationInputSchema.partial().extend({ id: z.string() });

// ─── Resource ─────────────────────────────────────────────────────────────────

export const resourceInputSchema = z.object({
	entityName: z.string().optional(),
	entityId: z.string().optional(),
	name: z.string().min(1),
	exposedOps: z.array(z.string()),
	queryConfig: z.record(z.unknown()).optional(),
	defaultPolicyId: z.string().optional(),
});
export type ResourceInput = z.infer<typeof resourceInputSchema>;
export type ResourcePatch = Partial<ResourceInput> & { id: string };
export type ResourceRef = { id: string };
const resourcePatchSchema = resourceInputSchema.partial().extend({ id: z.string() });

// ─── Operation ────────────────────────────────────────────────────────────────

export const operationInputSchema = z.object({
	name: z.string().min(1),
	kind: z.enum(["QUERY", "COMMAND", "WORKFLOW"]),
	inputSchema: z.record(z.unknown()),
	outputSchema: z.record(z.unknown()).optional(),
	reads: z.array(z.string()).optional(),
	writes: z.array(z.string()).optional(),
	steps: z.array(z.unknown()),
	bodyHint: z.string().optional(),
});
export type OperationInput = z.infer<typeof operationInputSchema>;
export type OperationPatch = Partial<OperationInput> & { id: string };
export type OperationRef = { id: string };
const operationPatchSchema = operationInputSchema.partial().extend({ id: z.string() });

// ─── Policy ───────────────────────────────────────────────────────────────────

export const policyInputSchema = z.object({
	name: z.string().min(1),
	scope: z.enum(["RESOURCE", "OPERATION", "ENTITY", "FIELD"]),
	resourceId: z.string().optional(),
	operationId: z.string().optional(),
	entityName: z.string().optional(),
	entityId: z.string().optional(),
	fieldName: z.string().optional(),
	effect: z.enum(["ALLOW", "DENY"]).optional(),
	rule: z.unknown(),
});
export type PolicyInput = z.infer<typeof policyInputSchema>;
export type PolicyPatch = Partial<PolicyInput> & { id: string };
export type PolicyRef = { id: string };
const policyPatchSchema = policyInputSchema.partial().extend({ id: z.string() });

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const workflowInputSchema = z.object({
	name: z.string().min(1),
	inputSchema: z.record(z.unknown()).optional(),
	steps: z.array(z.unknown()).optional(),
	durability: z.record(z.unknown()).optional(),
	bodyHint: z.string().optional(),
});
export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type WorkflowPatch = Partial<WorkflowInput> & { id: string };
export type WorkflowRef = { id: string };
const workflowPatchSchema = workflowInputSchema.partial().extend({ id: z.string() });

// ─── Trigger ──────────────────────────────────────────────────────────────────

export const triggerInputSchema = z.object({
	name: z.string().min(1),
	kind: z.enum(["EVENT", "SCHEDULE", "WEBHOOK"]),
	source: z.record(z.unknown()),
	operationName: z.string().optional(),
	operationId: z.string().optional(),
	inputMapping: z.record(z.unknown()).optional(),
});
export type TriggerInput = z.infer<typeof triggerInputSchema>;
export type TriggerPatch = Partial<TriggerInput> & { id: string };
export type TriggerRef = { id: string };
const triggerPatchSchema = triggerInputSchema.partial().extend({ id: z.string() });

// ─── Integration ──────────────────────────────────────────────────────────────

export const integrationInputSchema = z.object({
	key: z.string().min(1),
	provider: z.string().min(1),
	capabilities: z.array(z.string()),
	configSchema: z.record(z.unknown()).optional(),
	secretRefs: z.record(z.unknown()).optional(),
});
export type IntegrationInput = z.infer<typeof integrationInputSchema>;
export type IntegrationPatch = Partial<IntegrationInput> & { id: string };
export type IntegrationRef = { id: string };
const integrationPatchSchema = integrationInputSchema.partial().extend({ id: z.string() });

// ─── Asset ────────────────────────────────────────────────────────────────────

export const assetInputSchema = z.object({
	storage: z.record(z.unknown()),
	mimeType: z.string().min(1),
	sizeBytes: z.number().int().optional(),
	contentHash: z.string().optional(),
	originalName: z.string().optional(),
	entityId: z.string().optional(),
	attributeName: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
});
export type AssetInput = z.infer<typeof assetInputSchema>;
export type AssetPatch = Partial<AssetInput> & { id: string };
export type AssetRef = { id: string };
const assetPatchSchema = assetInputSchema.partial().extend({ id: z.string() });

// ─── AuthMethod ───────────────────────────────────────────────────────────────

export const authMethodInputSchema = z.object({
	name: z.string().min(1),
	kind: z.enum(["SESSION", "BEARER", "HMAC", "APIKEY"]),
	config: z.record(z.unknown()),
	isDefault: z.boolean().optional(),
});
export type AuthMethodInput = z.infer<typeof authMethodInputSchema>;
export type AuthMethodPatch = Partial<AuthMethodInput> & { id: string };
export type AuthMethodRef = { id: string };
const authMethodPatchSchema = authMethodInputSchema.partial().extend({ id: z.string() });

// ─── Screen ───────────────────────────────────────────────────────────────────

export const screenInputSchema = z.object({
	path: z.string().min(1),
	type: z.string().optional(),
	titleKey: z.string().optional(),
	order: z.number().int().optional(),
});
export type ScreenInput = z.infer<typeof screenInputSchema>;
export type ScreenPatch = Partial<ScreenInput> & { id: string };
export type ScreenRef = { id: string };
const screenPatchSchema = screenInputSchema.partial().extend({ id: z.string() });

// ─── Component ────────────────────────────────────────────────────────────────

export const componentInputSchema = z.object({
	type: z.string().min(1),
	screenPath: z.string().optional(),
	screenId: z.string().optional(),
	parentId: z.string().optional(),
	order: z.number().int().optional(),
	config: z.record(z.unknown()).optional(),
});
export type ComponentInput = z.infer<typeof componentInputSchema>;
export type ComponentPatch = Partial<ComponentInput> & { id: string };
export type ComponentRef = { id: string };
const componentPatchSchema = componentInputSchema.partial().extend({ id: z.string() });

// ─── Form ─────────────────────────────────────────────────────────────────────

export const formInputSchema = z.object({
	componentId: z.string().optional(),
	componentRef: z.string().optional(),
	entityId: z.string().optional(),
	operationName: z.string().optional(),
	operationId: z.string().optional(),
	inputMapping: z.record(z.unknown()).optional(),
	onSuccess: z.unknown().optional(),
	onError: z.unknown().optional(),
	submitKey: z.string().optional(),
});
export type FormInput = z.infer<typeof formInputSchema>;
export type FormPatch = Partial<FormInput> & { id: string };
export type FormRef = { id: string };
const formPatchSchema = formInputSchema.partial().extend({ id: z.string() });

// ─── Field ────────────────────────────────────────────────────────────────────

export const fieldInputSchema = z.object({
	formId: z.string().optional(),
	formRef: z.string().optional(),
	name: z.string().min(1),
	type: z.string().min(1),
	order: z.number().int().optional(),
	required: z.boolean().optional(),
	defaultValue: z.string().optional(),
	labelKey: z.string().optional(),
	placeholderKey: z.string().optional(),
	helpKey: z.string().optional(),
	config: z.record(z.unknown()).optional(),
});
export type FieldInput = z.infer<typeof fieldInputSchema>;
export type FieldPatch = Partial<FieldInput> & { id: string };
export type FieldRef = { id: string };
const fieldPatchSchema = fieldInputSchema.partial().extend({ id: z.string() });

// ─── Action ───────────────────────────────────────────────────────────────────

export const actionInputSchema = z.object({
	kind: z.string().min(1),
	componentId: z.string().optional(),
	componentRef: z.string().optional(),
	targetType: z.string().min(1),
	targetId: z.string().optional(),
	data: z.record(z.unknown()).optional(),
});
export type ActionInput = z.infer<typeof actionInputSchema>;
export type ActionPatch = Partial<ActionInput> & { id: string };
export type ActionRef = { id: string };
const actionPatchSchema = actionInputSchema.partial().extend({ id: z.string() });

// ─── DataBinding ──────────────────────────────────────────────────────────────

export const dataBindingInputSchema = z.object({
	componentId: z.string().optional(),
	componentRef: z.string().optional(),
	source: z.record(z.unknown()),
	query: z.record(z.unknown()).optional(),
});
export type DataBindingInput = z.infer<typeof dataBindingInputSchema>;
export type DataBindingPatch = Partial<DataBindingInput> & { id: string };
export type DataBindingRef = { id: string };
const dataBindingPatchSchema = dataBindingInputSchema.partial().extend({ id: z.string() });

// ─── TestScenario ─────────────────────────────────────────────────────────────

export const testScenarioInputSchema = z.object({
	name: z.string().min(1),
	operationId: z.string().optional(),
	operationName: z.string().optional(),
	screenId: z.string().optional(),
	screenPath: z.string().optional(),
	inputs: z.record(z.unknown()).optional(),
	expected: z.record(z.unknown()).optional(),
	mocks: z.record(z.unknown()).optional(),
});
export type TestScenarioInput = z.infer<typeof testScenarioInputSchema>;
export type TestScenarioPatch = Partial<TestScenarioInput> & { id: string };
export type TestScenarioRef = { id: string };
const testScenarioPatchSchema = testScenarioInputSchema.partial().extend({ id: z.string() });

// ─── Full DeltaSpec schema ────────────────────────────────────────────────────

export const deltaSpecSchema = z
	.object({
		productSpecs: deltaBlock(productSpecInputSchema, productSpecPatchSchema),
		screenSpecs: deltaBlock(screenSpecInputSchema, screenSpecPatchSchema),
		requirements: deltaBlock(requirementInputSchema, requirementPatchSchema),
		entities: deltaBlock(entityInputSchema, entityPatchSchema),
		attributes: deltaBlock(attributeInputSchema, attributePatchSchema),
		relations: deltaBlock(relationInputSchema, relationPatchSchema),
		resources: deltaBlock(resourceInputSchema, resourcePatchSchema),
		operations: deltaBlock(operationInputSchema, operationPatchSchema),
		policies: deltaBlock(policyInputSchema, policyPatchSchema),
		workflows: deltaBlock(workflowInputSchema, workflowPatchSchema),
		triggers: deltaBlock(triggerInputSchema, triggerPatchSchema),
		integrations: deltaBlock(integrationInputSchema, integrationPatchSchema),
		assets: deltaBlock(assetInputSchema, assetPatchSchema),
		authMethods: deltaBlock(authMethodInputSchema, authMethodPatchSchema),
		screens: deltaBlock(screenInputSchema, screenPatchSchema),
		components: deltaBlock(componentInputSchema, componentPatchSchema),
		forms: deltaBlock(formInputSchema, formPatchSchema),
		fields: deltaBlock(fieldInputSchema, fieldPatchSchema),
		actions: deltaBlock(actionInputSchema, actionPatchSchema),
		dataBindings: deltaBlock(dataBindingInputSchema, dataBindingPatchSchema),
		testScenarios: deltaBlock(testScenarioInputSchema, testScenarioPatchSchema),
	})
	.passthrough();

export type DeltaSpec = z.infer<typeof deltaSpecSchema>;
