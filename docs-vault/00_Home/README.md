# DTFS — Home

DTFS (Design-to-Fullstack) is a meta-platform that converts a natural-language description of an app into a fully generated, deployable full-stack application. It operates through a 10-layer pipeline, always routing through formal specs and DSLs — never prompt-to-code directly. The platform stores definitions in the Control Plane (Postgres schema `dtfs`) and generates isolated Client Apps (schema `gen_<slug>`). It is governed by 102 MCP tools, 19 specialized agents, and 20 slash commands.

See: [[MAP_OF_CONTENT]] · [[AI_INDEX]] · [[GLOSSARY]] · [[ARCHITECTURE_OVERVIEW]]

---

## Main entry points

| Topic | Start here |
|---|---|
| Understand the platform | [[ARCHITECTURE_OVERVIEW]] → [[EXECUTION_FLOW]] |
| Product intent & personas | [[PRODUCT_VISION]] → [[PRODUCT_SPEC]] → [[PERSONAS]] |
| Control Plane model | [[CONTROL_PLANE_MODEL]] → [[DELTA_SPEC]] → [[CHANGESET_REVISION]] |
| Generated app pipeline | [[GENERATED_APP_OVERVIEW]] → [[BACKEND_CONTRACT]] → [[FRONTEND_CONTRACT]] |
| AI agent rules | [[AI_INDEX]] → [[AI_RULES]] → [[AI_DO_NOT_BREAK]] |
| Diagrams | [[08_Diagrams/README]] |
| Decision log | [[09_ADR/README]] |

---

## Status

`documented` — vault built 2026-05-24. See [[BUILD_REPORT]] for completeness details and known gaps.
