# Chimera Core

Chimera Core is the browser-based host web app for the Chimera benchmark system.

This repository contains only the core Next.js application. Benchmark implementations are planned to live in separate repositories and be loaded through a registry-driven workflow.

## Benchmark registry (v1)

Chimera Core now includes a typed local benchmark registry for UI display and contract shaping.

- Registry source data lives in [`data/benchmark-registry.json`](data/benchmark-registry.json).
- The app validates and loads this file in [`LOCAL_BENCHMARK_REGISTRY`](src/core/registry/registry.ts:115).
- The registry stores benchmark metadata plus future loading fields (`repoUrl`, `defaultRef`, `entrypoint`, and trust/status flags).
- Benchmark repositories are external to this repo and are represented by references only.
- Add/remove benchmarks by editing the JSON array in [`data/benchmark-registry.json`](data/benchmark-registry.json): add or remove an entry object, keep required fields non-empty, and keep `id` unique.
- Current entries are local examples used to define the first contract and UI shape.
- No cloning, package installation, benchmark execution, database integration, or model API calls are implemented in this step.

## Benchmark detail pages (v1)

- The home registry card/list links each benchmark to `/benchmarks/[id]`.
- The detail page resolves entries from the same static registry by `id`.
- Unknown benchmark IDs render a clean route-level not-found page.
- Detail pages are read-only metadata views only (no execution, loading, or persistence behavior).

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

