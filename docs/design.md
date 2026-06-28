# Chimera v1 Design Summary

## Core app

This repo is the core browser app that hosts benchmark execution and result presentation flows.

## External benchmark repos

Benchmark implementations are not stored here. They will live in separate repositories and be referenced by this app.

## Registry-driven loading

The core app will use a registry model to discover and load benchmark definitions/providers from external sources.

### Registry contract (v1)

The first typed registry contract is defined in core code and now backed by a local JSON registry file plus app-layer TypeScript validation.

Each benchmark registry entry includes:

- `id`
- `name`
- `description`
- `weaknessCategory`
- `repoUrl`
- `defaultRef`
- `entrypoint`
- `trustMode`
- `status`

Notes for this version:

- Source entries live in `data/benchmark-registry.json` and are loaded/validated in the app layer.
- Entries are displayed in the core UI as local example metadata.
- `repoUrl`/`defaultRef`/`entrypoint` fields exist to support future external-repo loading.
- No cloning, install, dynamic loading, execution, persistence, or provider/API calls are included yet.

## Scoring/results UI (later)

Scoring details, run history, and richer results views will be added in later iterations.

## Benchmark detail route (current)

- A route-level benchmark detail page exists at `/benchmarks/[id]`.
- The page reads from the same validated JSON-backed registry used by the home page.
- Unknown IDs render a clean not-found experience for that route segment.
- This remains metadata-only UI; no clone/install/provider/execution/storage behavior was added.

## Home registry UI (current)

- The home route renders a card/list layout for benchmark entries.
- Displayed fields include name, id, description, weakness category, trust mode, status, repo URL, and link to details.
- UI includes an explicit note that benchmarks are external repos referenced by the registry file.

