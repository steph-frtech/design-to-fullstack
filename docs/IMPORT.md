# Import Pipeline — HTML & Figma

Phase 14 adds an alternative entry point into the design pipeline: start from an **HTML page** or a **Figma export JSON** instead of a natural-language description. The import pipeline is **deterministic** (no LLM calls server-side) and **additive** — it **enriches or proposes corrections** to existing ScreenSpecs; it does **not overwrite** them.

---

## Pipeline overview

```
HTML string           ─┐
Figma JSON / fileKey  ─┤──► analyzeHtml / analyzeFigma
                        │       (deterministic structural parse)
                        │
                        ├──► diffHtmlAgainstScreenSpec
                        │       (compare to existing ScreenSpec)
                        │
                        └──► htmlAnalysisToProposal / designAnalysisToProposal
                                (produce ProposalContents — Phase 6 format)
                                        │
                                        └──► PlatformSpecProposal (DRAFT, persisted)
                                                 ↓ human review
                                             dtfs__apply_delta_spec (when ACCEPTED)
```

The import **never creates entities**. It synthesizes a `PlatformSpecProposal` in DRAFT status, just like `propose_platform_spec`. A human must review and apply it.

---

## Types

### `HtmlAnalysis`

```ts
type HtmlAnalysis = {
  title?: string;
  headings: { level: 1|2|3|4|5|6; text: string }[];
  sections: { tag: string; id?: string; className?: string }[];
  forms: FormAnalysis[];
  components: ComponentAnalysis[];
  tables: TableAnalysis[];
  assets: AssetRef[];
  actions: ActionRef[];
  stats: {
    totalForms, totalFields, totalActions,
    totalAssets, totalHeadings, totalSections
  };
};
```

### `FormAnalysis`

```ts
type FormAnalysis = {
  id?: string;
  action?: string;
  method?: string;
  fields: FieldAnalysis[];
};
```

### `FieldAnalysis`

```ts
type FieldAnalysis = {
  name: string;
  htmlType: string;       // raw: "text", "email", "checkbox", ...
  attributeType: AttributeType; // mapped Control Plane FieldType
  required: boolean;
  label?: string;
  placeholder?: string;
  multiple?: boolean;
};
```

### `UiDelta`

```ts
type UiDelta = {
  missingInSpec: DeltaItem[];  // in HTML, not in ScreenSpec
  missingInHtml: DeltaItem[];  // in ScreenSpec, not in HTML
  matched: MatchedItem[];
  suggestions: string[];
};
```

### `DesignAnalysis`

```ts
type DesignAnalysis = {
  fileName?: string;
  frames: DesignComponentNode[];
  texts: DesignTextNode[];
  images: DesignImageRef[];
  components: DesignComponentNode[];
  stats: { totalFrames, totalTexts, totalImages, totalComponents };
};
```

---

## HTML input type → AttributeType mapping

| HTML type          | AttributeType  |
| ------------------ | -------------- |
| text, search, tel, url | TEXT       |
| email              | EMAIL          |
| password           | PASSWORD       |
| number             | NUMBER         |
| date, month, week  | DATE           |
| datetime-local     | DATETIME       |
| time               | TIME           |
| checkbox           | CHECKBOX       |
| radio              | RADIO          |
| file               | FILE           |
| color              | COLOR          |
| range              | RANGE          |
| hidden             | HIDDEN         |
| textarea           | TEXTAREA       |
| select             | SELECT         |
| select[multiple]   | MULTISELECT    |
| anything else      | CUSTOM         |

---

## HTTP endpoints

All mounted under `/api/projects/:id/import`.

| Method | Path              | Body                                    | Response          |
| ------ | ----------------- | --------------------------------------- | ----------------- |
| POST   | /html/analyze     | `{ html }`                              | `{ analysis }`    |
| POST   | /html/diff        | `{ screenSpecId, html }`                | `{ uiDelta }`     |
| POST   | /html/proposal    | `{ html, featureKey?, screenSpecId? }`  | `{ id, proposal, envelope }` |
| POST   | /figma/analyze    | `{ figmaJson?, fileKey? }`              | `{ analysis }` or `501` with error |
| POST   | /design/proposal  | `{ figmaJson?, fileKey?, featureKey? }` | `{ id, proposal, envelope }` or `501` |

---

## MCP tools

| Tool name                       | Purpose |
| ------------------------------- | ------- |
| `dtfs__analyze_html`            | Parse HTML → HtmlAnalysis (no DB) |
| `dtfs__diff_html`               | Compare HTML to a ScreenSpec → UiDelta |
| `dtfs__import_html_proposal`    | HTML → PlatformSpecProposal (DRAFT, persisted) |
| `dtfs__analyze_figma`           | Figma JSON or API → DesignAnalysis |
| `dtfs__import_design_proposal`  | Figma → PlatformSpecProposal (DRAFT, persisted) |

---

## Figma configuration

- If `FIGMA_TOKEN` env var is set and `fileKey` is provided, the backend fetches from the Figma REST API (`GET /v1/files/:key`).
- If `figmaJson` is provided in the body, the backend parses it directly (no API call, no token required).
- If neither is available, the endpoint returns `{ error: "figma_not_configured", hint: "..." }` with HTTP 501.

**Never hardcode a Figma token.** Use the `FIGMA_TOKEN` env var exclusively.

---

## Example — analyze a contact form

```bash
HTML='<html><head><title>Contact</title></head><body>
  <h1>New Contact</h1>
  <form>
    <label>Name<input name="name" type="text" required></label>
    <label>Email<input name="email" type="email"></label>
    <button type="submit">Save</button>
  </form>
  <img src="/logo.png" alt="logo">
</body></html>'

# Analyze
curl -s -X POST http://localhost:4002/api/projects/$PID/import/html/analyze \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg h "$HTML" '{html:$h}')" | jq '{title:.analysis.title, forms:(.analysis.forms|length)}'
# → { "title": "Contact", "forms": 1 }

# Generate proposal (DRAFT, no entities created)
curl -s -X POST http://localhost:4002/api/projects/$PID/import/html/proposal \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg h "$HTML" '{html:$h}')" | jq '{id:.id, entities:(.proposal.entities|length)}'
# → { "id": "...", "entities": 1 }
```

---

## Important: the import does NOT replace ScreenSpec

- `html/proposal` persists a `PlatformSpecProposal` in **DRAFT** status.
- **No entities, attributes, screens, or fields are created in the database.**
- To apply the proposal, review it and call `dtfs__apply_delta_spec` (or compile it to a DeltaSpec first with `dtfs__create_delta_from_platform_proposal`).
- All inferred elements carry `config.source = "html-import"` for traceability.
