# 02 — Delta Spec Flow

Layers 6–8: from PlatformSpecProposal to committed (or reverted) ChangeSet.

This diagram covers the transactional write path into the Control Plane. Every mutation is grouped under a ChangeSet, ensuring full reversibility.

```mermaid
flowchart TD
    A[PlatformSpecProposal\naccepted by user] --> B[compileProposalToDelta\nPOST /delta-spec/from-proposal]
    B --> C[DeltaSpec\ncreates · updates · deletes buckets]
    C --> D{validateDeltaSpec\noptional static lint}
    D -- ok --> E[begin ChangeSet\nDRAFT state]
    D -- errors --> Z1[fix & retry]
    E --> F[applyDeltaSpec\nwrites rows · emits Revisions]
    F --> G{commit or discard?}
    G -- commit --> H[commitChangeSet\nDRAFT → APPLIED]
    G -- discard --> Z2[discardChangeSet\ndelete DRAFT + Revisions]
    H --> I[revert possible\ncreates inverse APPLIED CS\nAPPLIED → REVERTED]
```

## Raccourci one-shot

`POST /api/projects/:id/delta-spec/apply` — ouvre, applique et commit en un seul appel.

## Ordre d'application des buckets

ProductSpecs → ScreenSpecs → Requirements → Entities → Attributes → Relations → Policies → Integrations → Operations → Resources → Triggers → Screens → Deletes

## Concepts liés

- [[CHANGESET_FLOW]] — documentation complète + exemples curl
- [[DELTA_SPEC]] — format DeltaSpec
- [[05-change-set-reversibility]] — schéma Excalidraw du lifecycle

> Status: stable
