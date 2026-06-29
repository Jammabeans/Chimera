# Chimera Core

Chimera Core is the browser-based host web app for the Chimera benchmark system.

This repository contains only the core Next.js application. Benchmark implementations are planned to live in separate repositories and be loaded through a registry-driven workflow.

- The app now uses a simple shared shell with a top navigation (`Home`, `Readiness`, `Contract`, `Registry`, `Sync`, `Cache`, `Runs`) and a wider main content area for readability.

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
- Detail pages now combine registry metadata with current local cache/readiness state.
- Detail pages show cache status, manifest valid (`yes`/`no`), ready (`yes`/`no`), and a short status message.
- When local cache has a valid manifest, detail pages also show a cached manifest preview (`id`, `name`, `version`, `weaknessCategory`, `supportedModes`, `level count`, `owner`).
- Detail pages remain read-only (no execution, loading, or persistence behavior).

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

## Sync page + manual sync (v1)

Chimera Core now includes a sync view at `/sync` that shows planned benchmark-to-cache mapping and allows a manual sync attempt for one benchmark at a time.

- Page route: [`/sync`](src/app/sync/page.tsx)
- Planner utility: [`getSyncPlan()`](src/core/registry/getSyncPlan.ts:27)
- Manual sync utility: [`runManualBenchmarkSync()`](src/core/registry/runManualBenchmarkSync.ts:46)
- Cache path convention: `benchmarks-cache/<benchmark-id>/`
- Expected external manifest location after sync: `benchmark.manifest.json` at repo root
- Expected local manifest path in plan output: `benchmarks-cache/<benchmark-id>/benchmark.manifest.json`
- Manual sync source of truth is the approved registry entry (`approvedRepoUrl` + `defaultRef`), not form/user input.
- Basic safety checks in v1 manual sync:
  - unknown benchmark IDs are rejected
  - benchmark ID format is validated (kebab-case)
  - trust mode must be `allowlisted`
  - resolved path must remain inside the `benchmarks-cache` base directory
- v1 sync behavior is intentionally narrow:
  - clone only when the target cache directory is missing
  - if cache directory already exists, return `already-exists` and do not fetch/pull
  - no bulk sync, package install, dynamic import, benchmark execution, model API, or database behavior

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
- When status is `manifest-valid`, the page also shows a parsed manifest preview (`id`, `name`, `version`, `weaknessCategory`, `supportedModes`, `level count`, `owner`).
- Scope remains inspection-only by default. Sync mutation occurs only when explicitly triggered from `/sync`.

## Benchmark readiness page (v1)

Chimera Core now includes a benchmark readiness view at `/readiness` for a practical “can this benchmark be used yet?” signal.

- Page route: [`/readiness`](src/app/readiness/page.tsx)
- Shared utility: [`getBenchmarkReadiness()`](src/core/registry/getBenchmarkReadiness.ts:53)
- Readiness is `true` only when all of the following are true:
  - benchmark exists in the registry
  - cache directory exists
  - root manifest exists at `benchmark.manifest.json`
  - manifest passes current cache inspection validation logic
- Readiness report fields include benchmark id/name, cache status, manifest validity, ready boolean, readiness label, and a short readiness message.
- Home page benchmark cards also include small readiness badges (`Ready` / `Not ready`) for quick scanning.

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

## Runtime benchmark contract (v1)

Chimera Core now also defines a separate **runtime** benchmark contract for manual deterministic benchmark runs.

- Runtime contract types are defined in [`src/types/runtimeBenchmarkContract.ts`](src/types/runtimeBenchmarkContract.ts).
- The runtime contract is intentionally separate from:
  - registry entry types in [`BenchmarkRegistryEntry`](src/types/benchmark.ts:20)
  - external manifest contract types in [`ExternalBenchmarkManifest`](src/types/externalBenchmarkContract.ts:10)
- A typed runtime module example is provided in [`RUNTIME_BENCHMARK_MODULE_EXAMPLE`](src/core/runner/runtimeBenchmarkModuleExample.ts:37).
- The contract page at [`/contract`](src/app/contract/page.tsx) now documents the manifest contract, runtime module contract, and static runtime JSON contract.

Minimal runtime v1 shape:

- Runtime benchmark module:
  - `manifest`
  - `cases`
  - `scoreAnswer(caseId, answerText)`
- Benchmark case:
  - `id`
  - `levelId`
  - `title`
  - `prompt`
  - optional `metadata`
- Answer submission:
  - `answerText`
- Score result:
  - `correct`
  - `score`
  - `expectedAnswer`
  - `message`

Runtime scope boundaries in this step:

- plain text answers only
- static deterministic cases only
- simple scoring only
- no execution UI yet
- no model API calls

## Static runtime benchmark JSON contract (v1)

Chimera Core now defines a separate static JSON contract for deterministic runtime artifacts stored at benchmark repo root as [`runtime-benchmark.json`](runtime-benchmark.json).

- Static JSON contract types are defined in [`src/types/runtimeBenchmarkJsonContract.ts`](src/types/runtimeBenchmarkJsonContract.ts).
- This JSON contract is intentionally separate from the in-memory runtime module types in [`src/types/runtimeBenchmarkContract.ts`](src/types/runtimeBenchmarkContract.ts).
- A typed static artifact example is provided in [`RUNTIME_BENCHMARK_JSON_ARTIFACT_EXAMPLE`](src/core/runner/runtimeBenchmarkJsonArtifactExample.ts:3).
- v1 scoring mode is fixed to `scoringMode: "exact-text"`.

Minimal static JSON v1 shape:

- Runtime benchmark artifact:
  - `benchmarkId`
  - `benchmarkName`
  - `scoringMode`
  - `cases`
- Runtime case:
  - `id`
  - `levelId`
  - `title`
  - `prompt`
  - `expectedAnswer`
  - optional `metadata`

Static JSON scope boundaries in this step:

- plain text answers only
- static deterministic cases only
- exact-text scoring only
- manual run UI only
- no API routes

## Provider execution (v1: OpenAI first path)

Chimera Core now includes the first actual provider execution path using OpenAI.

- Provider execution contract types remain in [`src/types/providerExecutionContract.ts`](src/types/providerExecutionContract.ts).
- OpenAI provider utility lives in [`src/core/providers/openaiProvider.ts`](src/core/providers/openaiProvider.ts).
- Server-side provider execution + scoring composition lives in [`src/core/runner/executeProviderBenchmarkCase.ts`](src/core/runner/executeProviderBenchmarkCase.ts).
- The benchmark run page at [`/benchmarks/[id]/run`](src/app/benchmarks/[id]/run/page.tsx) now supports:
  - selecting one case
  - entering a `modelId` (default: `gpt-4o-mini`)
  - `Run with OpenAI`
  - rendering provider output text
  - exact-text scoring against `expectedAnswer`
  - readable provider error messages

Provider behavior in this step:

- first provider only: `openai`
- one benchmark case at a time
- non-streaming request via server-side `fetch` to OpenAI REST API
- plain-text output extraction
- minimal safe error handling for missing API key and provider/API failures

## Manual run flow (v1)

Chimera Core now includes the first manual benchmark run route at `/benchmarks/[id]/run`.

- Route: `/benchmarks/[id]/run`
- Runtime loader: `getRuntimeBenchmarkJsonFromCache()` in `src/core/registry/getRuntimeBenchmarkJsonFromCache.ts`
- Scoring helper: `scoreRuntimeBenchmarkCase()` in `src/core/runner/scoreRuntimeBenchmarkCase.ts`
- Runtime source: cached repo-root artifact in benchmark cache:
  - `benchmarks-cache/<benchmark-id>/runtime-benchmark.json`

v1 run behavior:

- user opens run page for a known benchmark id
- page shows benchmark name/id and runtime JSON found/valid state
- if runtime JSON is valid, page lists available cases
- user selects one case, sees prompt text, enters plain text answer
- submit triggers server-side exact-text scoring against `expectedAnswer`
- page renders deterministic result fields:
  - `correct`
  - `score`
  - `expectedAnswer`
  - `message`
- after scoring, the page attempts to append a local history record to `data/manual-run-history.json`
- history write failures are non-fatal: score result still renders and a small warning is shown
- run page includes a small benchmark-scoped recent runs list (latest 5)
- run page includes a small benchmark-scoped recent model runs list (latest 5)
- global history page is available at `/runs` as one combined reverse-chronological timeline of manual + model runs

Validation for cached runtime JSON is intentionally minimal/practical:

- file exists
- JSON parses
- required top-level fields exist (`benchmarkId`, `benchmarkName`, `scoringMode`, `cases`)
- `scoringMode` is `exact-text`
- `cases` is an array

If runtime JSON is missing/invalid, the run page shows a clean message and does not crash.

Benchmark detail pages now include a small link to the manual run page.

## Manual run history (v1)

Chimera Core now stores manual run history in one local flat JSON file.

- Storage file: [`data/manual-run-history.json`](data/manual-run-history.json)
- Storage utility: [`manualRunHistory`](src/core/storage/manualRunHistory.ts)
- Scope is intentionally narrow:
  - local file only
  - manual benchmark runs only
  - no database
  - no model API integration
- Stored fields include:
  - `timestamp`
  - `benchmarkId`
  - `benchmarkName`
  - `caseId`
  - `caseTitle`
  - `submittedAnswer`
  - `expectedAnswer`
  - `correct`
  - `score`
  - `scoringMode`

## Model run history (v1)

Chimera Core now stores model/provider run history in a separate local flat JSON file.

- Storage file: [`data/model-run-history.json`](data/model-run-history.json)
- Storage utility: [`modelRunHistory`](src/core/storage/modelRunHistory.ts)
- Scope is intentionally narrow:
  - local file only
  - model/provider benchmark runs only
  - no database
- Stored fields include:
  - `timestamp`
  - `benchmarkId`
  - `benchmarkName`
  - `caseId`
  - `caseTitle`
  - `providerId`
  - `modelId`
  - `prompt`
  - `outputText`
  - `expectedAnswer`
  - `correct`
  - `score`
  - `durationMs`

## Combined run timeline on `/runs` (v1)

- Timeline utility: [`getCombinedRunTimeline()`](src/core/storage/getCombinedRunTimeline.ts:99)
- `/runs` now reads both local history files and normalizes them into one display shape with `runType`:
  - `manual`
  - `model`
- Timeline entries are sorted by timestamp descending.
- Model timeline cards include provider/model output fields (`providerId`, `modelId`, `outputText`, `expectedAnswer`, `correct`, `score`).
- Manual timeline cards preserve existing manual fields (`submittedAnswer`, `expectedAnswer`, `correct`, `score`, `scoringMode`).

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Required environment variable for provider execution:

```bash
OPENAI_API_KEY=your_openai_api_key
```

Then open http://localhost:3000.

