---
name: design-to-spec
description: Convert a design (Figma link, screenshot, or HTML/CSS) into a structured spec — pages, components, data model, API endpoints — that downstream skills can implement.
---

# design-to-spec

Placeholder skill. Goal: take a visual design and emit a structured spec consumable by code-generation skills downstream.

## Inputs

- Figma URL, image, or HTML/CSS snippet.

## Outputs

- `spec.json` describing pages, components, data model entities, and required API endpoints.

## Steps

1. Identify screens and reusable components in the input.
2. Infer the data model from forms, lists, and detail views.
3. Derive the API surface (CRUD endpoints, auth requirements).
4. Emit `spec.json`.

> This file is a stub — flesh it out as the project grows.
