// Sample seed demonstrating ALL Control Plane V1 concepts.
// Run via: pnpm --filter backend seed:todo
//
// Output : one project "todo-list-multi-user" + one ChangeSet "seed:todo-list-multi-user"
// grouping every Revision emitted by the seed.

import { prisma } from "./db";
import { runInChangeSet } from "./lib/changeset-context";

async function main() {
	console.log("seeding todo-list-multi-user…");

	// User (demo) — OUTSIDE the project ChangeSet (it's a global row).
	const user = await prisma.user.upsert({
		where: { email: "demo@design-to-fullstack.local" },
		update: {},
		create: {
			id: "demo-user",
			email: "demo@design-to-fullstack.local",
			name: "Demo User",
		},
	});

	// Locale en (default).
	const en = await prisma.locale.upsert({
		where: { code: "en" },
		update: {},
		create: { code: "en", name: "English", isDefault: true },
	});

	// Drop previous if exists (idempotent rerun).
	const existing = await prisma.project.findUnique({
		where: { slug: "todo-list-multi-user" },
	});
	if (existing) {
		await prisma.project.delete({ where: { id: existing.id } });
		console.log("  ↳ dropped previous instance");
	}

	// Project + its ChangeSet for the seed.
	const project = await prisma.project.create({
		data: {
			slug: "todo-list-multi-user",
			ownerId: user.id,
			defaultLocaleId: en.id,
			enabledScreenTypes: ["web"],
			locales: { create: [{ localeId: en.id }] },
		},
	});

	const cs = await prisma.changeSet.create({
		data: {
			projectId: project.id,
			message: "seed: todo-list-multi-user",
			actorId: user.id,
			status: "DRAFT",
		},
	});

	await runInChangeSet(
		{ changeSetId: cs.id, projectId: project.id, actorId: user.id, origin: "explicit" },
		async () => {
			// ─── Entities ──────────────────────────────────────────
			const todoList = await prisma.entity.create({
				data: { projectId: project.id, name: "TodoList" },
			});
			const todoItem = await prisma.entity.create({
				data: { projectId: project.id, name: "TodoItem" },
			});
			const shareLink = await prisma.entity.create({
				data: { projectId: project.id, name: "ShareLink" },
			});

			// Attributes (typed but minimal).
			await prisma.attribute.create({
				data: {
					entityId: todoList.id,
					name: "title",
					type: "TEXT",
					required: true,
				},
			});
			await prisma.attribute.create({
				data: {
					entityId: todoList.id,
					name: "ownerId",
					type: "TEXT",
					required: true,
				},
			});
			await prisma.attribute.create({
				data: {
					entityId: todoItem.id,
					name: "listId",
					type: "TEXT",
					required: true,
				},
			});
			await prisma.attribute.create({
				data: {
					entityId: todoItem.id,
					name: "label",
					type: "TEXT",
					required: true,
				},
			});
			await prisma.attribute.create({
				data: {
					entityId: todoItem.id,
					name: "done",
					type: "CHECKBOX",
					required: false,
					config: { default: false },
				},
			});
			await prisma.attribute.create({
				data: {
					entityId: shareLink.id,
					name: "listId",
					type: "TEXT",
					required: true,
				},
			});
			await prisma.attribute.create({
				data: {
					entityId: shareLink.id,
					name: "token",
					type: "TEXT",
					required: true,
					unique: true,
				},
			});

			// ─── Relations ─────────────────────────────────────────
			await prisma.entityRelation.create({
				data: {
					projectId: project.id,
					fromEntityId: todoItem.id,
					toEntityId: todoList.id,
					name: "list",
					kind: "ONE_TO_MANY",
					fromField: "listId",
				},
			});
			await prisma.entityRelation.create({
				data: {
					projectId: project.id,
					fromEntityId: shareLink.id,
					toEntityId: todoList.id,
					name: "list",
					kind: "ONE_TO_MANY",
					fromField: "listId",
				},
			});

			// ─── Policies (use JSONata-friendly leaves) ────────────
			const isOwner = await prisma.policy.create({
				data: {
					projectId: project.id,
					name: "is-todo-list-owner",
					scope: "ENTITY",
					entityId: todoList.id,
					effect: "ALLOW",
					rule: {
						eq: ["$.record.ownerId", "$.auth.user.id"],
					},
				},
			});
			await prisma.policy.create({
				data: {
					projectId: project.id,
					name: "authenticated-only",
					scope: "OPERATION",
					effect: "ALLOW",
					rule: { exists: "$.auth.user.id" },
				},
			});

			// ─── Resources ─────────────────────────────────────────
			await prisma.resource.create({
				data: {
					projectId: project.id,
					entityId: todoList.id,
					name: "todo-lists",
					exposedOps: ["list", "read", "create", "update", "delete"],
					queryConfig: {
						pagination: { kind: "offset", default: 20, max: 100 },
						sort: { allowed: ["createdAt", "title"], default: ["createdAt"] },
						filter: [{ field: "ownerId", operators: ["eq"] }],
					},
					defaultPolicyId: isOwner.id,
				},
			});
			await prisma.resource.create({
				data: {
					projectId: project.id,
					entityId: todoItem.id,
					name: "todo-items",
					exposedOps: ["list", "read", "create", "update", "delete"],
					queryConfig: {
						pagination: { kind: "offset", default: 50, max: 200 },
						filter: [
							{ field: "listId", operators: ["eq"] },
							{ field: "done", operators: ["eq"] },
						],
					},
				},
			});

			// ─── Operations (Step DSL) ─────────────────────────────
			await prisma.operation.create({
				data: {
					projectId: project.id,
					name: "createTodoList",
					kind: "COMMAND",
					inputSchema: {
						type: "object",
						required: ["title"],
						properties: { title: { type: "string", minLength: 1 } },
					},
					reads: [],
					writes: ["TodoList"],
					steps: [
						{ kind: "authorize", policy: "authenticated-only" },
						{
							kind: "mutate",
							op: "create",
							entity: "TodoList",
							data: '{ "title": $.input.title, "ownerId": $.auth.user.id }',
							as: "list",
						},
						{ kind: "return", value: "$.list" },
					],
				},
			});
			await prisma.operation.create({
				data: {
					projectId: project.id,
					name: "createTodoItem",
					kind: "COMMAND",
					inputSchema: {
						type: "object",
						required: ["listId", "label"],
						properties: {
							listId: { type: "string" },
							label: { type: "string", minLength: 1 },
						},
					},
					reads: ["TodoList"],
					writes: ["TodoItem"],
					steps: [
						{
							kind: "read",
							entity: "TodoList",
							where: '{ "id": $.input.listId }',
							as: "parentList",
						},
						{ kind: "authorize", policy: "is-todo-list-owner" },
						{
							kind: "mutate",
							op: "create",
							entity: "TodoItem",
							data: '{ "listId": $.input.listId, "label": $.input.label, "done": false }',
							as: "item",
						},
						{ kind: "return", value: "$.item" },
					],
				},
			});
			await prisma.operation.create({
				data: {
					projectId: project.id,
					name: "toggleTodoItem",
					kind: "COMMAND",
					inputSchema: {
						type: "object",
						required: ["itemId", "done"],
						properties: {
							itemId: { type: "string" },
							done: { type: "boolean" },
						},
					},
					reads: ["TodoItem"],
					writes: ["TodoItem"],
					steps: [
						{
							kind: "mutate",
							op: "update",
							entity: "TodoItem",
							where: '{ "id": $.input.itemId }',
							data: '{ "done": $.input.done }',
							as: "item",
						},
						{ kind: "return", value: "$.item" },
					],
				},
			});
			await prisma.operation.create({
				data: {
					projectId: project.id,
					name: "createShareLink",
					kind: "COMMAND",
					inputSchema: {
						type: "object",
						required: ["listId"],
						properties: { listId: { type: "string" } },
					},
					reads: ["TodoList"],
					writes: ["ShareLink"],
					steps: [
						{ kind: "authorize", policy: "is-todo-list-owner" },
						{
							kind: "mutate",
							op: "create",
							entity: "ShareLink",
							data: '{ "listId": $.input.listId, "token": $.system.randomToken }',
							as: "link",
						},
						{
							kind: "return",
							value: '{ "url": "/share/" & $.link.token }',
						},
					],
				},
			});

			// ─── Behavior ──────────────────────────────────────────
			await prisma.behavior.create({
				data: {
					projectId: project.id,
					entityId: todoList.id,
					kind: "ownable",
					config: { ownerField: "ownerId" },
				},
			});
		},
	);

	// Commit the seed ChangeSet.
	await prisma.changeSet.update({
		where: { id: cs.id },
		data: { status: "APPLIED", appliedAt: new Date() },
	});

	console.log(
		`✓ seeded project ${project.slug} (id=${project.id}) under ChangeSet ${cs.id}`,
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
