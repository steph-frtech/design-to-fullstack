# 00 — Global Flow

Complete pipeline from Natural App Description to Docker Runtime.

This diagram covers all 10 layers of the DTFS execution flow, from free-text input to a containerised running application.

```mermaid
flowchart TD
    A[Natural App Description] --> B[ProductSpec]
    B --> C[ScreenSpec]
    C --> D[OpenQuestions & Assumptions]
    D --> E[Spec Kit Artifacts]
    E --> F[Requirements]
    F --> G[PlatformSpecProposal]
    G --> H[DeltaSpec]
    H --> I[validate_spec]
    I --> J[ChangeSet]
    J --> K[RuntimeTarget]
    K --> L[BackendContract]
    K --> M[FrontendContract]
    K --> N[SharedContract]
    L --> O[validateContracts]
    M --> O
    N --> O
    O --> P[Codegen]
    P --> Q[Generated Client App]
    Q --> R[Docker Runtime]
```

## Concepts liés

- [[EXECUTION_FLOW]] — walk-through détaillé de chaque couche
- [[RUNTIME_CONTRACTS_OVERVIEW]] — couche contracts
- [[CHANGESET_FLOW]] — lifecycle ChangeSet
- [[00-global-architecture]] — schéma Excalidraw

> Status: stable
