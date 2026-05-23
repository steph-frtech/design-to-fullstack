// Idempotent seed for the DTFS demo: 1 user, 2 locales, 1 project,
// 1 entity (Contact), 1 screen with a form (firstName/email/category),
// translated labels, a few records.
//
// Run via: pnpm --filter backend seed

import { prisma } from "./db";

async function main() {
	console.log("seeding…");

	// ─── User ──────────────────────────────────────────────────────────
	const user = await prisma.user.upsert({
		where: { email: "demo@design-to-fullstack.local" },
		update: {},
		create: {
			id: "demo-user",
			email: "demo@design-to-fullstack.local",
			name: "Demo User",
		},
	});

	// ─── Locales ───────────────────────────────────────────────────────
	const en = await prisma.locale.upsert({
		where: { code: "en" },
		update: {},
		create: { code: "en", name: "English", isDefault: true },
	});
	const fr = await prisma.locale.upsert({
		where: { code: "fr" },
		update: {},
		create: { code: "fr", name: "Français" },
	});

	// ─── Project (created first so TextKeys can reference it) ─────────
	const project = await prisma.project.upsert({
		where: { slug: "demo" },
		update: {},
		create: {
			slug: "demo",
			ownerId: user.id,
			defaultLocaleId: en.id,
		},
	});

	// ─── TextKeys + Translations (scoped to project) ──────────────────
	const t = async (
		namespace: string,
		en_value: string,
		fr_value: string,
	) => {
		const key = await prisma.textKey.upsert({
			where: {
				projectId_namespace: { projectId: project.id, namespace },
			},
			update: {},
			create: { projectId: project.id, namespace },
		});
		await prisma.translation.upsert({
			where: { textKeyId_localeId: { textKeyId: key.id, localeId: en.id } },
			update: { value: en_value },
			create: { textKeyId: key.id, localeId: en.id, value: en_value },
		});
		await prisma.translation.upsert({
			where: { textKeyId_localeId: { textKeyId: key.id, localeId: fr.id } },
			update: { value: fr_value },
			create: { textKeyId: key.id, localeId: fr.id, value: fr_value },
		});
		return key.namespace;
	};

	const projectName = await t("project.demo.name", "Demo Project", "Projet démo");
	const screenTitle = await t("screen.contact.title", "Contact us", "Nous contacter");
	const entityName = await t("entity.contact.name", "Contact", "Contact");
	const fNameLabel = await t("field.firstName.label", "First name", "Prénom");
	const fNamePh = await t("field.firstName.placeholder", "Jane", "Jeanne");
	const emailLabel = await t("field.email.label", "Email", "Courriel");
	const emailHelp = await t("field.email.help", "We never share it.", "Jamais partagé.");
	const categoryLabel = await t("field.category.label", "Category", "Catégorie");
	const optSales = await t("field.category.sales", "Sales", "Ventes");
	const optSupport = await t("field.category.support", "Support", "Support");
	const optOther = await t("field.category.other", "Other", "Autre");
	const submitLabel = await t("form.contact.submit", "Send", "Envoyer");

	// Set the project nameKey now that the key exists
	if (project.nameKey !== projectName) {
		await prisma.project.update({
			where: { id: project.id },
			data: { nameKey: projectName },
		});
	}

	for (const localeId of [en.id, fr.id]) {
		await prisma.projectLocale.upsert({
			where: { projectId_localeId: { projectId: project.id, localeId } },
			update: {},
			create: { projectId: project.id, localeId },
		});
	}

	await prisma.theme.upsert({
		where: { projectId: project.id },
		update: {},
		create: {
			projectId: project.id,
			tokens: {
				colors: { primary: "#0070f3", background: "#ffffff", text: "#171717" },
				fontFamily: "Geist, sans-serif",
				radius: { sm: "4px", md: "8px", lg: "12px" },
			},
		},
	});

	// ─── Entity + Attributes ───────────────────────────────────────────
	const contact = await prisma.entity.upsert({
		where: { projectId_name: { projectId: project.id, name: "Contact" } },
		update: {},
		create: { projectId: project.id, name: "Contact", nameKey: entityName },
	});

	for (const a of [
		{ name: "firstName", type: "TEXT" as const, required: true },
		{ name: "email", type: "EMAIL" as const, required: true, unique: true },
		{ name: "category", type: "SELECT" as const, required: true },
		{ name: "message", type: "TEXTAREA" as const, required: false },
	]) {
		await prisma.attribute.upsert({
			where: { entityId_name: { entityId: contact.id, name: a.name } },
			update: {},
			create: { entityId: contact.id, ...a },
		});
	}

	// ─── Screen + Components + Form + Fields ───────────────────────────
	const screen = await prisma.screen.upsert({
		where: { projectId_path: { projectId: project.id, path: "/contact" } },
		update: { type: "web" },
		create: {
			projectId: project.id,
			path: "/contact",
			type: "web",
			titleKey: screenTitle,
		},
	});

	// Idempotency for components: delete and recreate on rerun.
	await prisma.component.deleteMany({ where: { screenId: screen.id } });

	const root = await prisma.component.create({
		data: {
			screenId: screen.id,
			type: "container",
			order: 0,
			config: { className: "max-w-md mx-auto py-12" },
		},
	});

	const formComp = await prisma.component.create({
		data: {
			parentId: root.id,
			type: "form",
			order: 0,
			config: {},
		},
	});

	const form = await prisma.form.create({
		data: {
			componentId: formComp.id,
			entityId: contact.id,
			submitKey: submitLabel,
		},
	});

	const firstName = await prisma.field.create({
		data: {
			formId: form.id,
			name: "firstName",
			type: "TEXT",
			order: 0,
			required: true,
			labelKey: fNameLabel,
			placeholderKey: fNamePh,
			config: { minLength: 1, maxLength: 80 },
		},
	});
	void firstName;

	const email = await prisma.field.create({
		data: {
			formId: form.id,
			name: "email",
			type: "EMAIL",
			order: 1,
			required: true,
			labelKey: emailLabel,
			helpKey: emailHelp,
			config: { pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", maxLength: 255 },
		},
	});
	void email;

	const category = await prisma.field.create({
		data: {
			formId: form.id,
			name: "category",
			type: "SELECT",
			order: 2,
			required: true,
			labelKey: categoryLabel,
			config: {},
		},
	});

	for (const [i, opt] of (
		[
			{ value: "sales", labelKey: optSales },
			{ value: "support", labelKey: optSupport },
			{ value: "other", labelKey: optOther },
		] as const
	).entries()) {
		await prisma.fieldOption.create({
			data: { fieldId: category.id, value: opt.value, labelKey: opt.labelKey, order: i },
		});
	}

	// ─── Sample records ────────────────────────────────────────────────
	const existingRecords = await prisma.entityRecord.count({ where: { entityId: contact.id } });
	if (existingRecords === 0) {
		await prisma.entityRecord.create({
			data: {
				entityId: contact.id,
				data: { firstName: "Alice", email: "alice@example.com", category: "sales" },
			},
		});
		await prisma.entityRecord.create({
			data: {
				entityId: contact.id,
				data: { firstName: "Bob", email: "bob@example.com", category: "support", message: "Help" },
			},
		});
	}

	console.log("seed done. project:", project.slug);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
