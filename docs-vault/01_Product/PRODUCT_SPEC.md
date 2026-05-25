# PRODUCT_SPEC

Le pipeline produit DTFS transforme une description naturelle en une application cliente générée au travers d'une chaîne de 10 maillons, chacun produisant un artefact structuré. Aucun maillon ne peut être court-circuité : chaque artefact est la condition préalable du suivant.

Liens : [[PRODUCT_VISION]] · [[EXECUTION_FLOW]] · [[CONTROL_PLANE]] · [[CLIENT_APP_RUNTIME]]

---

## Pipeline bout-en-bout

```
Natural App Description          <- prose / HTML / Figma (transient, Layer 0)
  |
ProductSpec                      <- but, personas, objectifs, glossaire (Layer 1)
  |
ScreenSpec                       <- champs, actions, dataNeeds, etats (Layer 2)
  |
OpenQuestion / Assumption        <- clarification gate (Layer 3)
  |
SpecArtifact (Spec Kit)          <- constitution / spec / plan / tasks (Layer 4)
  |
Requirement -> RequirementMapping <- chaque exigence mappee sur un concept (Layer 5)
  |
DeltaSpec                        <- creates/updates/deletes JSON (Layer 6)
  |
validate_spec + governance checks <- gate : bloquant avant apply (Layer 7)
  |
ChangeSet -> ProjectSpec          <- groupe de Revisions committe (Layer 8)
  |
RuntimeTarget                    <- quelle stack ? hono-next (par defaut)
  |
BackendContract + FrontendContract + SharedContract  <- compilation
  |
validateContracts()              <- gate : bloquant avant codegen
  |
GeneratedArtifact rows + fichiers <- Layer 9 (codegen)
  |
TestScenario -> fichiers de tests + AuditLog  <- Layer 10
  |
Client App Runtime               <- apps/api . apps/web . packages/shared
```

## Description de chaque maillon

| Maillon | Table(s) Control Plane | Note |
|---|---|---|
| Natural App Description | — | Transient, jamais persiste |
| ProductSpec | `ProductSpec` | Objet JSON structure : purpose, personas, goals, glossary |
| ScreenSpec | `ScreenSpec` | Par ecran : fields, actions, dataNeeds, states |
| Clarification | `OpenQuestion` · `Assumption` | Gate : questions OPEN bloquent la generation |
| Spec Kit | `SpecArtifact` (CONSTITUTION/SPEC/PLAN/TASKS) | Markdown inspectable, engagement du LLM |
| Platform Mapping | `Requirement` · `RequirementMapping` | Chaque exigence vers un ou plusieurs concepts |
| DeltaSpec | Runtime-only (body HTTP) | 21 buckets create/update/delete |
| Validation | — (endpoints stateless) | `validate_spec`, `validate_expr`, `validate_policy` |
| ChangeSet | `ChangeSet` · `Revision` | Seul chemin d'ecriture legal |
| RuntimeTarget | `RuntimeTarget` | Declare la stack cible |
| Contrats | `BackendContract` · `FrontendContract` · `SharedContract` | Representation intermediaire persistee en DB |
| Codegen | `GeneratedArtifact` | Fichiers emis avec contentHash + flag protected |
| Test & Audit | `TestScenario` · `AuditLog` | Scenarios declaratifs + log des actions |

## Liens vers les pages detaillees

- Contrats : [[CONTROL_PLANE]] (BackendContract, FrontendContract, SharedContract)
- Flux d'execution complet : [[EXECUTION_FLOW]]
- App cliente generee : [[CLIENT_APP_RUNTIME]]

## Source of truth

`docs/EXECUTION_FLOW.md` · `docs/RUNTIME_CONTRACTS_OVERVIEW.md` · `docs/ARCHITECTURE.md`

## AI usage

Ce fichier sert de carte de navigation. Un agent qui recoit une description naturelle doit traverser chaque maillon dans l'ordre. Sauter un maillon (ex. : passer de DeltaSpec a codegen sans valider les contrats) est une violation de gouvernance.

## Status

documented
