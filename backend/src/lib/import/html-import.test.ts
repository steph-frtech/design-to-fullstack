// Phase 14 — Import pipeline tests (node:test, no DB required).
// Run with: pnpm --filter backend exec tsx --test src/lib/import/html-import.test.ts

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeHtml } from "./html-analyze";
import { diffHtmlAgainstScreenSpec } from "./html-diff";
import { htmlAnalysisToProposal } from "./html-to-proposal";
import { analyzeFigma } from "./figma-analyze";

// ─── analyzeHtml tests ────────────────────────────────────────────────────────

describe("analyzeHtml", () => {
	it("parses a form with 3 inputs and maps their types correctly", () => {
		const html = `
			<html><body>
			<form id="contact">
				<label>Name<input name="name" type="text" required></label>
				<label>Email<input name="email" type="email"></label>
				<label>Subscribe<input name="subscribe" type="checkbox"></label>
				<button type="submit">Send</button>
			</form>
			</body></html>
		`;
		const result = analyzeHtml(html);
		assert.equal(result.forms.length, 1, "should have 1 form");
		const form0 = result.forms[0];
		assert.ok(form0, "form 0 exists");
		assert.equal(form0!.fields.length, 3, "form should have 3 fields");

		const nameField = form0!.fields.find((f) => f.name === "name");
		const emailField = form0!.fields.find((f) => f.name === "email");
		const checkField = form0!.fields.find((f) => f.name === "subscribe");

		assert.ok(nameField, "name field should exist");
		assert.equal(nameField!.attributeType, "TEXT");
		assert.equal(nameField!.required, true);

		assert.ok(emailField, "email field should exist");
		assert.equal(emailField!.attributeType, "EMAIL");
		assert.equal(emailField!.required, false);

		assert.ok(checkField, "subscribe checkbox should exist");
		assert.equal(checkField!.attributeType, "CHECKBOX");

		// Button should appear in actions
		const submitActions = result.actions.filter((a) => a.kind === "submit");
		assert.ok(submitActions.length >= 1, "should have at least 1 submit action");
	});

	it("extracts title, headings, buttons, and img assets", () => {
		const html = `
			<html>
			<head><title>Contact Page</title></head>
			<body>
				<h1>New Contact</h1>
				<h2>Details</h2>
				<button type="button">Cancel</button>
				<img src="/logo.png" alt="logo">
			</body>
			</html>
		`;
		const result = analyzeHtml(html);
		assert.equal(result.title, "Contact Page");
		assert.ok(result.headings.some((h) => h.level === 1 && h.text === "New Contact"), "h1 should be present");
		assert.ok(result.headings.some((h) => h.level === 2 && h.text === "Details"), "h2 should be present");
		assert.ok(result.actions.some((a) => a.label === "Cancel"), "Cancel button action");
		assert.equal(result.assets.length, 1, "1 image asset");
		const asset0 = result.assets[0];
		assert.ok(asset0, "asset 0 exists");
		assert.equal(asset0!.alt, "logo");
		assert.equal(asset0!.src, "/logo.png");
	});

	it("maps all major HTML input types to correct AttributeType", () => {
		const html = `<form>
			<input name="a" type="number">
			<input name="b" type="date">
			<textarea name="c"></textarea>
			<select name="d"><option>x</option></select>
			<select name="e" multiple><option>y</option></select>
			<input name="f" type="file">
			<input name="g" type="password">
		</form>`;
		const result = analyzeHtml(html);
		const fields = result.forms[0]!.fields;
		const byName = Object.fromEntries(fields.map((f) => [f.name, f.attributeType]));
		assert.equal(byName["a"], "NUMBER");
		assert.equal(byName["b"], "DATE");
		assert.equal(byName["c"], "TEXTAREA");
		assert.equal(byName["d"], "SELECT");
		assert.equal(byName["e"], "MULTISELECT");
		assert.equal(byName["f"], "FILE");
		assert.equal(byName["g"], "PASSWORD");
	});
});

// ─── diffHtmlAgainstScreenSpec tests ─────────────────────────────────────────

describe("diffHtmlAgainstScreenSpec", () => {
	it("detects a component declared in ScreenSpec but absent from HTML", () => {
		const html = `<html><body><main><p>Hello</p></main></body></html>`;
		const analysis = analyzeHtml(html);
		const screenSpec = {
			components: [{ kind: "DataTable", label: "DataTable" }],
			fields: [],
			actions: [],
			dataNeeds: [],
		};
		const delta = diffHtmlAgainstScreenSpec(analysis, screenSpec);
		const missing = delta.missingInHtml.filter((i) => i.kind === "component");
		assert.ok(missing.length >= 1, "DataTable should appear in missingInHtml");
		assert.ok(missing.some((m) => m.name.toLowerCase().includes("datatable")), "DataTable name found");
	});

	it("detects a field in HTML that is not in ScreenSpec", () => {
		const html = `<form><input name="newField" type="text"></form>`;
		const analysis = analyzeHtml(html);
		const screenSpec = { components: [], fields: [], actions: [], dataNeeds: [] };
		const delta = diffHtmlAgainstScreenSpec(analysis, screenSpec);
		const missing = delta.missingInSpec.filter((i) => i.kind === "field");
		assert.ok(missing.length >= 1, "newField should be missingInSpec");
		assert.ok(missing.some((m) => m.name === "newField"));
	});
});

// ─── htmlAnalysisToProposal tests ─────────────────────────────────────────────

describe("htmlAnalysisToProposal", () => {
	it("converts a form to 1 entity candidate + N attributes + 1 screen", () => {
		const html = `
			<html><head><title>User Form</title></head><body>
			<form id="user">
				<input name="username" type="text" required>
				<input name="email" type="email" required>
				<input name="age" type="number">
				<button type="submit">Save</button>
			</form>
			</body></html>
		`;
		const analysis = analyzeHtml(html);
		const envelope = htmlAnalysisToProposal(analysis, { projectId: "proj_test" });

		assert.ok(envelope.proposal.screens && envelope.proposal.screens.length >= 1, "1 screen");
		assert.ok(envelope.proposal.entities && envelope.proposal.entities.length >= 1, "at least 1 entity");
		assert.ok(envelope.proposal.attributes && envelope.proposal.attributes.length >= 3, "at least 3 attributes");
		// Verify entity name
		const entityNames = (envelope.proposal.entities ?? []).map((e) => e.name);
		assert.ok(entityNames.some((n) => n.length > 0), "entity has a name");
		// Verify attribute source tag
		const attrs = envelope.proposal.attributes ?? [];
		const attr = attrs[0];
		assert.ok(attr, "at least one attribute");
		assert.ok((attr!.config as Record<string, unknown>)?.source === "html-import", "attribute has html-import source");
	});
});

// ─── analyzeFigma tests ───────────────────────────────────────────────────────

describe("analyzeFigma", () => {
	it("extracts frames, texts, and images from a minimal Figma export JSON", () => {
		const figmaJson = {
			name: "Test File",
			document: {
				id: "doc",
				name: "Document",
				type: "DOCUMENT",
				children: [
					{
						id: "page1",
						name: "Page 1",
						type: "CANVAS",
						children: [
							{
								id: "frame1",
								name: "Main Frame",
								type: "FRAME",
								children: [
									{
										id: "text1",
										name: "Title",
										type: "TEXT",
										characters: "Hello World",
										style: { fontSize: 24 },
									},
									{
										id: "rect1",
										name: "Hero Image",
										type: "RECTANGLE",
										fills: [{ type: "IMAGE", imageRef: "abc123" }],
									},
								],
							},
						],
					},
				],
			},
		};

		const result = analyzeFigma(figmaJson);
		assert.ok(!("error" in result), "should not be an error");
		if ("error" in result) return;
		assert.ok(result.frames.length >= 1, "at least 1 frame");
		assert.ok(result.texts.length >= 1, "at least 1 text");
		assert.ok(result.images.length >= 1, "at least 1 image");
		const text0 = result.texts[0];
		assert.ok(text0, "text 0 exists");
		assert.equal(text0!.text, "Hello World");
		assert.equal(result.stats.totalFrames, result.frames.length);
	});

	it("returns figma_not_configured error when no json and no token", () => {
		// Save + clear FIGMA_TOKEN
		const savedToken = process.env.FIGMA_TOKEN;
		delete process.env.FIGMA_TOKEN;

		// analyzeFigma with null/undefined input (simulates empty body, no token)
		const result = analyzeFigma(null);
		assert.ok("error" in result, "should return an error");
		assert.ok(result.error === "figma_invalid_json" || result.error === "figma_not_configured");

		if (savedToken !== undefined) process.env.FIGMA_TOKEN = savedToken;
	});
});
