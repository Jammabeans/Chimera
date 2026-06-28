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
- The page now reuses existing cache-inspection and readiness utilities to include current local state alongside registry metadata.
- Current local-state fields on details include:
  - cache status
  - manifest valid boolean
  - ready boolean
  - short readiness/status message
- When cached manifest is valid, details also render a compact cached manifest preview (`id`, `name`, `version`, `weaknessCategory`, `supportedModes`, `level count`, `owner`).
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
- Manual sync for one benchmark at a time is now supported from this route via a server-side action.
- The action only uses approved registry metadata (`approvedRepoUrl` + `defaultRef`) for clone operations.
- Safety boundaries for this version:
  - reject unknown benchmark ids
  - reject invalid benchmark id format
  - reject non-allowlisted trust mode entries
  - reject path traversal via resolved-path containment checks
- Clone behavior in this version is intentionally narrow:
  - clone only when `benchmarks-cache/<benchmark-id>/` is missing
  - if cache directory already exists, do not fetch/pull; return `already exists`
  - no bulk sync, package install, dynamic import, execution, model APIs, database, or background jobs

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
- This page remains read-only in v1. Sync mutation is only triggered explicitly from `/sync`.

## Benchmark readiness route (current)

- A route-level readiness page exists at `/readiness`.
- It is powered by a shared utility: `src/core/registry/getBenchmarkReadiness.ts`.
- Readiness is intentionally strict for v1 and is `true` only when:
  - benchmark exists in the registry
  - cache directory exists
  - root `benchmark.manifest.json` exists
  - manifest passes the existing cache-inspection validation checks
- The readiness report returns practical fields per benchmark:
  - benchmark id
  - benchmark name
  - cache status
  - manifest valid boolean
  - ready boolean
  - short readiness label/message
- `/readiness` renders:
  - total benchmark count
  - ready count
  - not-ready count
  - one row/card per benchmark with clear status text
- The shared top nav includes `Readiness`.
- The home page includes small readiness badges on benchmark cards for quick scanability.

