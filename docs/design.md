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
- `approvedRepoUrl`
- `defaultRef`
- `entrypoint`
- `syncMode` (`manual` in v1)
- `trustMode`
- `status`

Notes for this version:

- Source entries live in `data/benchmark-registry.json` and are loaded/validated in the app layer.
- Entries are displayed in the core UI as local example metadata.
- `approvedRepoUrl` stores approved git URLs for external benchmark repos.
- `defaultRef` stores the sync ref (for manual sync planning in v1).
- `syncMode` is explicit and currently manual-only.
- No cloning, install, dynamic loading, execution, persistence, or provider/API calls are included yet.

### External benchmark repo contract (v1)

To prepare for separate benchmark repositories, Chimera Core now defines a minimal manifest contract distinct from registry entries.

Required external manifest fields:

- `id`
- `name`
- `version`
- `description`
- `weaknessCategory`
- `supportedModes`
- `entrypoint`
- `levels`
- `owner`

Current contract artifacts:

- Type contract: `src/types/externalBenchmarkContract.ts`
- Example manifest object: `src/core/registry/externalBenchmarkManifestExample.ts`
- Human-readable contract route: `/contract`

Notes for this version:

- Contract is intentionally minimal and loader-agnostic for v1.
- No clone/install/dynamic-import/execution/model API/storage behavior is implemented in this step.
- Registry entry types remain separate from external repo manifest types.

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
- Home route links to `/contract` for the external benchmark repo requirements.
- Home route also links to `/sync` for planned manual-sync mapping.

## Registry diagnostics route (current)

- A route-level diagnostics page exists at `/registry`.
- It validates local registry entries before any future syncing/loading attempts.
- Current checks are intentionally practical/minimal for v1:
  - required fields present and non-empty
  - `id` format sanity (lowercase kebab-case)
  - `approvedRepoUrl` URL parsing with `http/https`
  - `syncMode` support check (`manual`)
  - non-empty `entrypoint`
  - duplicate `id` detection
- The page renders total entry count, valid/invalid counts, and per-entry errors/warnings.
- No git/package/dynamic-import/execution/model API/database behavior is introduced.

## Sync planning route (current)

- A route-level sync planning page exists at `/sync`.
- It maps each registry entry into a planning record containing:
  - approved repo URL
  - target local cache path (`benchmarks-cache/<benchmark-id>/`)
  - expected local manifest path after sync (`benchmarks-cache/<benchmark-id>/benchmark.manifest.json`)
  - ref to sync
  - trust mode
  - status
- External benchmark repos are expected to expose `benchmark.manifest.json` at repo root.
- Sync itself is intentionally not implemented in this step (planning-only, manual-sync direction).

## Cache inspection route (current)

- A route-level cache inspection page exists at `/cache`.
- It inspects planned local cache state per registry entry using server-side filesystem checks.
- Current checks are intentionally practical/minimal for v1:
  - cache directory exists at `benchmarks-cache/<benchmark-id>/`
  - root manifest exists at `benchmarks-cache/<benchmark-id>/benchmark.manifest.json`
  - manifest parses as JSON
  - manifest passes basic shape checks against the external benchmark contract
- Per-entry status is one of:
  - `cache-missing`
  - `manifest-missing`
  - `manifest-invalid`
  - `manifest-valid`
- `/cache` renders benchmark name/id, cache path, manifest path, status, and validation errors (if any).
- For `manifest-valid` entries, `/cache` also renders a compact parsed manifest preview:
  - `id`
  - `name`
  - `version`
  - `weaknessCategory`
  - `supportedModes`
  - `level count`
  - `owner`
- This page is read-only in v1. No sync or mutation actions are triggered from this route.

