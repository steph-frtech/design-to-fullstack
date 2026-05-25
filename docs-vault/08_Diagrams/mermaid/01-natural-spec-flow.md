# 01 — Natural Spec Flow

Layers 0 to 5: from raw user description to structured Requirements.

This diagram covers the first half of the DTFS pipeline — the "understanding" phase where natural language is progressively structured into machine-readable spec artifacts.

```mermaid
flowchart TD
    A[Natural App Description\nfree prose + optional HTML/Figma] --> B[ProductSpec\nname · purpose · personas · goals · glossary]
    B --> C[ScreenSpec\nfields · actions · dataNeeds · states]
    C --> D1[OpenQuestion\nambiguities surfaced to the user]
    C --> D2[Assumption\ndecisions forced by silence]
    D1 --> E[SpecArtifact\nCONSTITUTION · SPEC · PLAN · TASKS]
    D2 --> E
    E --> F[Requirement\nFUNCTIONAL · NON_FUNCTIONAL · CONSTRAINT]
    F --> G[RequirementMapping\ntargetType · targetId]
```

## Agents impliqués

| Étape | Agent |
|-------|-------|
| ProductSpec | `dtfs-product-analyst` |
| ScreenSpec | `dtfs-screen-spec-writer` |
| Clarification | `dtfs-question-manager` |
| SpecArtifact | `dtfs-spec-writer` |
| Requirements | `dtfs-requirement-extractor` |

## Concepts liés

- [[EXECUTION_FLOW]] — Layers 0–5
- [[SPECKIT_INTEGRATION]] — SpecArtifact details
- [[01-control-plane-vs-client-runtime]] — où ces données sont stockées

> Status: stable
