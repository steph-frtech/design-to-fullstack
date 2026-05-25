---
description: Capture une description naturelle d'app dans un ProductSpec (Phase 1).
---

Lance l'agent `dtfs-product-analyst` sur la description fournie. L'agent
clarifie au besoin, extrait la ProductSpec, la persiste via MCP, et la
valide.

## Description

$ARGUMENTS

## Instructions

1. Identifie le projet cible. Si non précisé, demande à l'utilisateur ou
   liste les projets via `dtfs__list_projects`.
2. Lance l'agent `dtfs-product-analyst` avec la description ci-dessus.
3. Reporte le `productSpecId` créé et le résultat de la validation.
