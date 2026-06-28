# Chimera Core

Chimera Core is the browser-based host web app for the Chimera benchmark system.

This repository contains only the core Next.js application. Benchmark implementations are planned to live in separate repositories and be loaded through a registry-driven workflow.

- The app now uses a simple shared shell with a top navigation (`Home`, `Contract`, `Registry`, `Sync`, `Cache`) and a wider main content area for readability.

## Benchmark registry (v1)

Chimera Core now includes a typed local benchmark registry for UI display and contract shaping.

- Registry source data lives in [`data/benchmark-registry.json`](data/benchmark-registry.json).
- The app validates and loads this file in [`LOCAL_BENCHMARK_REGISTRY`](src/core/registry/registry.ts:136).
- The registry stores benchmark metadata plus future sync/loading fields (`approvedRepoUrl`, `defaultRef`, `entrypoint`, `syncMode`, and trust/status flags).
- External benchmark repos are referenced by approved git URLs (`approvedRepoUrl`).
- Sync mode is manual-only for v1 (`syncMode: "manual"`).
- Benchmark repositories are external to this repo and are represented by references only.
- Add/remove benchmarks by editing the JSON array in [`data/benchmark-registry.json`](data/benchmark-registry.json): add or remove an entry object, keep required fields non-empty, and keep `id` unique.
- Current entries are local examples used to define the first contract and UI shape.
- No cloning, package installation, benchmark execution, database integration, or model API calls are implemented in this step.

## Benchmark detail pages (v1)

- The home registry card/list links each benchmark to `/benchmarks/[id]`.
- The detail page resolves entries from the same static registry by `id`.
- Unknown benchmark IDs render a clean route-level not-found page.
- Detail pages are read-only metadata views only (no execution, loading, or persistence behavior).

## Registry diagnostics page (v1)

Chimera Core now includes a registry diagnostics view at `/registry` to validate local registry entries before any future repo sync/load flow.

- Page route: [`/registry`](src/app/registry/page.tsx)
- Validator utility: [`getRegistryDiagnostics()`](src/core/registry/getRegistryDiagnostics.ts:102)
- Current checks include:
  - required fields present/non-empty
  - sane `id` format (lowercase kebab-case)
  - `approvedRepoUrl` parses as URL with `http/https`
  - `syncMode` is supported (`manual`)
  - `entrypoint` non-empty
  - duplicate `id` detection
- Output includes total entries, valid vs invalid counts, and per-entry errors/warnings.
- This remains metadata-only validation; no cloning/install/import/execution/provider/database behavior is added.

## Sync planning page (v1)

Chimera Core now includes a sync planning view at `/sync` to show the planned mapping for future approved-repo syncs.

- Page route: [`/sync`](src/app/sync/page.tsx)
- Planner utility: [`getSyncPlan()`](src/core/registry/getSyncPlan.ts:26)
- Cache path convention: `benchmarks-cache/<benchmark-id>/`
- Expected external manifest location after sync: `benchmark.manifest.json` at repo root
- Expected local manifest path in plan output: `benchmarks-cache/<benchmark-id>/benchmark.manifest.json`
- This route is planning-only; manual sync is not implemented yet.

## Cache inspection page (v1)

Chimera Core now includes a read-only cache inspection view at `/cache` to check whether planned local benchmark caches already exist and whether root manifests are minimally valid.

- Page route: [`/cache`](src/app/cache/page.tsx)
- Inspector utility: [`getCacheInspection()`](src/core/registry/getCacheInspection.ts:122)
- For each registry entry, the inspector checks:
  - cache directory existence (`benchmarks-cache/<benchmark-id>/`)
  - root manifest presence (`benchmark.manifest.json`)
  - manifest JSON parse validity
  - basic manifest shape validity against [`ExternalBenchmarkManifest`](src/types/externalBenchmarkContract.ts:10)
- Per-entry status values:
  - `cache-missing`
  - `manifest-missing`
  - `manifest-invalid`
  - `manifest-valid`
- The page displays benchmark name/id, cache path, manifest path, status, and validation errors.
- Scope remains inspection-only: no clone/fetch/pull/install/dynamic-import/execution/model/database behavior is added.

## Benchmark repo contract (v1)

Chimera Core now defines a minimal external benchmark manifest contract that separate benchmark repos must provide.

- Contract types are defined in [`ExternalBenchmarkManifest`](src/types/externalBenchmarkContract.ts:9) and related types in [`src/types/externalBenchmarkContract.ts`](src/types/externalBenchmarkContract.ts).
- This contract is intentionally separate from registry entry types in [`BenchmarkRegistryEntry`](src/types/benchmark.ts:18).
- A sample manifest object is provided in [`EXTERNAL_BENCHMARK_MANIFEST_EXAMPLE`](src/core/registry/externalBenchmarkManifestExample.ts:3).
- A human-readable contract page is available at [`/contract`](src/app/contract/page.tsx).

Required manifest fields for v1:

- `id`
- `name`
- `version`
- `description`
- `weaknessCategory`
- `supportedModes`
- `entrypoint`
- `levels`
- `owner`

Scope boundaries for this step:

- No git cloning.
- No git pull/fetch.
- No package installation.
- No dynamic import/execution logic.
- No model API integration.
- No database/storage setup.

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Then open http://localhost:3000.

