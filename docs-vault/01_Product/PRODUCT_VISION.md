# PRODUCT_VISION

DTFS (Design-to-Fullstack) transforme une description en langage naturel en une application full-stack maintenable et déployable, sans vibe-coding direct. L'utilisateur décrit son intention ; la plateforme la structure, la valide, puis génère le backend, le frontend, l'authentification et la base de données. Chaque étape est tracée, réversible et auditable.

Liens : [[PRODUCT_SPEC]] · [[PERSONAS]] · [[USER_JOURNEYS]] · [[ARCHITECTURE_OVERVIEW]]

---

## Objectifs fondateurs

1. **Grand public / semi-tech** — toute personne capable de décrire une app en prose peut l'obtenir sans écrire de code.
2. **Intention structurée en specs** — la description naturelle est convertie en modèle déclaratif (ProductSpec, ScreenSpec, Requirements) avant toute génération.
3. **Modèle déclaratif** — l'app est un graphe d'entités, de ressources, de politiques, d'écrans : inspectable, diffable, revertable.
4. **Génère backend + frontend + auth + DB** — Hono 4 + Next 16 + Better Auth + PostgreSQL/Prisma 7, cible `generated-app/`.
5. **Tout tracé** — chaque mutation passe par un ChangeSet et produit une Revision ; l'historique est permanent.
6. **Réversible** — `revert_changeset` inverse n'importe quelle étape sans perte.

## Ce que DTFS n'est PAS

- Un générateur de boilerplate (pas de templates copiés/collés).
- Un outil de vibe-coding (le LLM ne va jamais directement de prompt vers code).
- Une plateforme no-code fermée (le code généré est standard et maintenable à la main).

## Source of truth

`docs/ARCHITECTURE.md` · `docs/EXECUTION_FLOW.md` · `README.md`

## AI usage

Les agents IA (`dtfs-product-analyst`, `dtfs-spec-writer`) lisent ce fichier pour cadrer leur rôle dans la chaîne de valeur. Ils ne doivent jamais contourner le pipeline pour générer du code directement.

## Status

documented
