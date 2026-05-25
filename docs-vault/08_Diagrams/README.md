# 08_Diagrams

Visual reference for the DTFS architecture and flows.

---

## Organisation

```
08_Diagrams/
  excalidraw/   — Large architecture diagrams, editable in Obsidian via the Excalidraw plugin
  mermaid/      — Technical flows as Mermaid code, rendered automatically by Obsidian
```

---

## excalidraw/

Each `.excalidraw` file is valid JSON and can be opened directly in:
- **Obsidian** with the [Excalidraw plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin)
- **excalidraw.com** (File → Open)
- Any editor that understands the format

A companion `.md` file lives alongside each diagram with a textual description of the schema content and a Status badge — useful when the Excalidraw render is minimal or the plugin is not installed.

Files:

| File | Description |
|------|-------------|
| `00-global-architecture.excalidraw` | Full system: from user input to Docker Runtime |
| `01-control-plane-vs-client-runtime.excalidraw` | Hard separation between Control Plane and generated Client App |
| `02-natural-language-to-codegen.excalidraw` | Spec pipeline: natural description → codegen |
| `03-contract-compilation.excalidraw` | Contract compilation phase (RuntimeTarget → three contracts → Codegen) |
| `04-docker-runtime-client-app.excalidraw` | Docker Compose topology of the generated client app |
| `05-change-set-reversibility.excalidraw` | ChangeSet lifecycle and revert mechanism |

---

## mermaid/

Each `.md` file contains a Mermaid flowchart rendered by Obsidian's native Mermaid renderer (no plugin required). Internal links use `[[...]]` Obsidian wiki-link syntax.

Files:

| File | Description |
|------|-------------|
| `00-global-flow.md` | Complete pipeline: Natural App Description → Docker Runtime |
| `01-natural-spec-flow.md` | Layers 0–4: description → ProductSpec → ScreenSpec → Clarification → Requirements |
| `02-delta-spec-flow.md` | Layers 6–8: PlatformSpecProposal → DeltaSpec → ChangeSet commit/revert |
| `03-contract-compilation-flow.md` | Layer 9a: RuntimeTarget → three contracts → validateContracts |
| `04-codegen-flow.md` | Layer 9b: contracts → generate → GeneratedArtifacts |
| `05-client-runtime-flow.md` | Layer 10: generated app → docker compose → running preview |
| `06-mcp-agent-flow.md` | MCP tools and DTFS agents orchestration |

---

## How to edit

- **Excalidraw diagrams**: open `.excalidraw` in Obsidian (Excalidraw plugin) or excalidraw.com. Export as SVG/PNG to `../assets/` for embedding elsewhere.
- **Mermaid diagrams**: edit the code block directly. Preview in Obsidian or any Mermaid playground.

## How to export

- Excalidraw: File → Export Image → SVG. Name convention: `<filename>.svg` in `../assets/`.
- Mermaid: copy the code block to [mermaid.live](https://mermaid.live) → Export SVG/PNG.

---

## Convention

| Status badge | Meaning |
|---|---|
| `Status: stable` | Matches current implementation |
| `Status: design-doc` | Documents a planned phase (not yet implemented) |
| `Status: cible` | Target state / roadmap item |

---

> Status: stable (diagrams reflect architecture as of 2026-05-25)
