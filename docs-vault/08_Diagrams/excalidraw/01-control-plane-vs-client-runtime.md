# 01 — Control Plane vs Client Runtime

> Status: stable

## What this diagram shows

A side-by-side view of the two worlds in DTFS and the strict boundary between them.

**LEFT — DTFS Control Plane** (red, shared across all projects):
- `control-plane-api` — Hono server on :4000, holds all spec/changeset/codegen routes
- `control-plane-db` — single Postgres instance containing Entity, Operation, Screen, ChangeSet, etc.
- MCP server — exposes `dtfs__*` tools for Claude Code / LLM agents
- Docs vault — Obsidian vault (this repo), the human-readable source of truth
- Codegen orchestrator — reads contracts, writes GeneratedArtifact files

**RIGHT — Client App Runtime** (blue, one per generated project):
- Hono API container — generated backend
- Next Web container — generated Next 16 frontend
- Postgres client DB — isolated database for the generated app
- optional Redis — session / cache layer
- optional object storage — for Asset uploads

**The arrow between them reads: "génère / pilote, ne mélange pas les données"**

This is the core architectural invariant: the Control Plane generates the Client App but never shares a database with it, never authenticates against it, and never queries it at runtime.

## Related notes

- [[SEPARATION_OF_CONCERNS]] — detailed explanation of the boundary
- [[DATA_OWNERSHIP]] — what data lives where
- [[CONTROL_PLANE]] — Control Plane internals
- [[CLIENT_APP_RUNTIME]] — Client App Runtime details
