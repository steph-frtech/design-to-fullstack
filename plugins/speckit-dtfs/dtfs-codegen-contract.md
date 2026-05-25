# dtfs Codegen Contract

> What the dtfs codegen guarantees and produces.
> Reference: `docs/CODEGEN.md`, `docs/CODEGEN_CONTRACT.md`

---

## What codegen consumes

Input: the fully-resolved spec of a project via `GET /api/projects/:id/spec`.

Before generation, three pre-passes are applied automatically:

1. **Behavior expansion** — every `Behavior` is replaced by the Resources/Operations/Policies/Attributes/Relations it represents. No Behavior reference leaks into generated code.
2. **Translation resolution** — every `*Key` field (`nameKey`, `labelKey`, etc.) is dereferenced. Generated app embeds strings inline for the default locale + an i18n file for others.
3. **Reference flattening** — every cross-concept reference (Form → Operation, Trigger → Operation, etc.) is verified and inlined.

## What codegen produces

| Layer | Output | Notes |
|---|---|---|
| Backend | Hono 4 route handlers | One file per Operation, typed via Zod |
| Backend | Prisma schema | One model per Entity, relations included |
| Backend | Policy middleware | One middleware per Policy |
| Frontend | Next.js App Router pages | One page per Screen (Page type) |
| Frontend | React components | One component per Form, one per list view |
| Frontend | i18n files | One JSON per locale |

## Guarantees

- **Deterministic**: same spec + same codegen version = byte-identical output
- **Well-formed**: generated code has no syntax errors and passes `tsc --noEmit`
- **Traceable**: every generated file has a header comment pointing to the source spec artifact (Entity ID, Operation name, Screen name)
- **Additive by default**: codegen does not delete files not tracked by the spec

## What codegen does NOT guarantee

- Business logic completeness: stubs have `// TODO: implement` placeholders for non-trivial logic
- Test coverage: generated tests are scaffold-level (happy-path only)
- Production readiness: generated code requires human review and completion
- Database seeding: no seed data is generated

## Invocation

```
dtfs__generate_app(projectId: "<project-id>", outputDir: "<path>")
```

Pre-condition: at least one ChangeSet with status `COMMITTED` must exist.

## Version compatibility

| Codegen version | Spec format | Notes |
|---|---|---|
| V1 | Phase 10+ schema | Entities, Operations, Policies, Screens, Relations |

## Reference

Full implementation details: `docs/CODEGEN.md`
Contract formalization: `docs/CODEGEN_CONTRACT.md`
