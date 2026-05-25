# 06 — MCP Agent Flow

How Claude Code and DTFS agents interact with the Control Plane via MCP tools.

The MCP server exposes `dtfs__*` tools over stdio. Claude Code calls them directly, and specialised sub-agents (`.claude/agents/dtfs-*`) orchestrate sequences of tool calls to implement multi-step workflows.

```mermaid
flowchart TD
    U[User] --> CC[Claude Code\nClaude Sonnet / Opus]
    CC --> |uses| MCP[MCP Server\ndtfs__* tools over stdio]
    MCP --> |HTTP| API[Control Plane API\nHono :4000]
    API --> |Prisma| DB[(Control Plane DB\nPostgres)]

    CC --> |sub-agent| A1[dtfs-product-analyst\nextract ProductSpec]
    CC --> |sub-agent| A2[dtfs-screen-spec-writer\nextract ScreenSpec]
    CC --> |sub-agent| A3[dtfs-requirement-extractor\nextract Requirements]
    CC --> |sub-agent| A4[dtfs-platform-mapper\nbuild PlatformSpecProposal]
    CC --> |sub-agent| A5[dtfs-spec-validator\nvalidate DeltaSpec]
    CC --> |sub-agent| A6[dtfs-sdd-writer\ngenerate spec doc]

    A1 --> MCP
    A2 --> MCP
    A3 --> MCP
    A4 --> MCP
    A5 --> MCP
    A6 --> MCP
```

## Principaux outils MCP

| Outil | Description |
|-------|-------------|
| `dtfs__begin_changeset` | Ouvre un DRAFT ChangeSet |
| `dtfs__apply_delta_spec` | Applique un DeltaSpec dans un ChangeSet ouvert |
| `dtfs__commit_changeset` | Commit DRAFT → APPLIED |
| `dtfs__discard_changeset` | Supprime un DRAFT |
| `dtfs__revert_changeset` | Crée un ChangeSet inverse (revert) |
| `dtfs__list_history` | Liste les ChangeSets d'un projet |
| `dtfs__validate_delta_spec` | Lint statique sans écriture DB |
| `dtfs__get_spec_at` | Snapshot du spec à un ChangeSet donné |

## Concepts liés

- [[MCP_TOOLS]] — documentation complète des outils
- [[EXECUTION_FLOW]] — comment les agents orchestrent le pipeline
- [[01-control-plane-vs-client-runtime]] — périmètre du Control Plane

> Status: stable (outils existants) · design-doc (nouveaux outils Phase 26)
