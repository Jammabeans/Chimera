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

### Runtime benchmark contract (v1)

Chimera Core now defines a second, separate contract for runtime benchmark modules used by manual deterministic runs.

Minimal runtime module shape:

- `manifest`
- `cases`
- `scoreAnswer(caseId, answerText)`

Minimal runtime case shape:

- `id`
- `levelId`
- `title`
- `prompt`
- optional `metadata`

Minimal answer submission shape:

- `answerText`

Minimal score result shape:

- `correct`
- `score`
- `expectedAnswer`
- `message`

Current runtime contract artifacts:

- Type contract: `src/types/runtimeBenchmarkContract.ts`
- Typed runtime example module: `src/core/runner/runtimeBenchmarkModuleExample.ts`
- Human-readable contract route (manifest + runtime module + static runtime JSON): `/contract`

Notes for this version:

- Runtime contract is intentionally simple for v1.
- Plain text answers only.
- Static deterministic cases only.
- Simple scoring only.
- Manual run flow will come before model API execution.
- No execution UI, API routes, or provider integrations are added in this step.

### Static runtime benchmark JSON contract (v1)

Chimera Core now defines a separate static JSON contract for deterministic runtime artifacts stored at benchmark repo root as `runtime-benchmark.json`.

Minimal static runtime artifact shape:

- `benchmarkId`
- `benchmarkName`
- `scoringMode` (`exact-text` in v1)
- `cases`

Minimal static runtime case shape:

- `id`
- `levelId`
- `title`
- `prompt`
- `expectedAnswer`
- optional `metadata`

Current static JSON contract artifacts:

- Type contract: `src/types/runtimeBenchmarkJsonContract.ts`
- Typed static artifact example: `src/core/runner/runtimeBenchmarkJsonArtifactExample.ts`
- Human-readable contract route: `/contract`

Notes for this version:

- This static JSON contract is intentionally separate from the in-memory runtime module contract.
- Contract remains plain-text-answer-only and deterministic.
- First manual run UI now exists at `/benchmarks/[id]/run` and uses cached `runtime-benchmark.json`.
- No API routes, dynamic loading, or model API behavior is added in this step.

### Provider/model execution contract (v1)

Chimera Core now uses this contract for practical provider execution paths (OpenAI + Ollama) while keeping scope narrow.

Minimal execution request shape:

- `benchmarkId`
- `caseId`
- `prompt`
- `providerId`
- `modelId`

Minimal execution response shape:

- `outputText`
- optional `rawResponseMetadata`

Minimal execution metadata shape:

- `timestamp`
- `durationMs`
- `providerId`
- `modelId`

Minimal scored model run result shape:

- `benchmarkId`
- `caseId`
- `prompt`
- `outputText`
- `expectedAnswer`
- `correct`
- `score`
- `metadata`

Current provider execution contract artifacts:

- Type contract: `src/types/providerExecutionContract.ts`
- Typed example objects: `src/core/providers/providerExecutionContractExample.ts`
- OpenAI provider utility: `src/core/providers/openaiProvider.ts`
- Ollama provider utility: `src/core/providers/ollamaProvider.ts`
- Provider execution runner composition: `src/core/runner/executeProviderBenchmarkCase.ts`
- Human-readable contract route (all contract surfaces): `/contract`

Notes for this version:

- Contract remains intentionally small and practical for v1.
- Supported provider paths are OpenAI and Ollama via server-side REST `fetch`.
- OpenAI request path: `POST https://api.openai.com/v1/responses`.
- Ollama request path: `POST <base-url>/api/generate` with non-streaming payload.
- Required environment variable for OpenAI: `OPENAI_API_KEY`.
- Ollama uses local/base-url configuration and does not require an API key in this step.
- Operator runs one benchmark case at a time.
- Model selection remains simple and provider-scoped:
  - OpenAI model dropdown (+ custom model)
  - Ollama model text input (+ optional base URL)
- No provider comparison analytics or broad provider architecture refactor in this step.

### Manual benchmark run flow (v1)

- Route-level run page exists at `/benchmarks/[id]/run`.
- Unknown benchmark ids preserve route-level not-found behavior.
- Runtime source is cached benchmark repo root artifact:
  - `benchmarks-cache/<benchmark-id>/runtime-benchmark.json`
- Run flow is intentionally narrow and deterministic:
  - operator selects one case at a time
  - prompt is shown as plain text
  - answer input is plain text only
  - scoring is exact string equality against case `expectedAnswer`
  - result fields are `correct`, `score`, `expectedAnswer`, `message`
  - after scoring, run result is appended to local file history (best-effort)
  - run page also supports model execution for selected case via OpenAI or Ollama
  - provider result fields include output text, exact-text score, and duration
  - provider errors are shown as readable non-crashing messages
- Runtime JSON loading/validation is implemented in a small server utility:
  - `src/core/registry/getRuntimeBenchmarkJsonFromCache.ts`
- Scoring logic is implemented in a small core helper:
  - `src/core/runner/scoreRuntimeBenchmarkCase.ts`
- Manual run history storage utility is implemented in:
  - `src/core/storage/manualRunHistory.ts`
- Model run history storage utility is implemented in:
  - `src/core/storage/modelRunHistory.ts`
- Model run history file is:
  - `data/model-run-history.json`
- Combined run timeline utility is implemented in:
  - `src/core/storage/getCombinedRunTimeline.ts`
- Global history view is available at `/runs` as one reverse-chronological timeline containing both:
  - manual runs (`runType: manual`)
  - model runs (`runType: model`)
- Benchmark run page also shows benchmark-scoped recent runs (latest 5 entries).
- Benchmark run page also shows benchmark-scoped recent model runs (latest 5 entries).

Validation remains practical/minimal for v1:

- file exists
- JSON parses
- required top-level fields exist (`benchmarkId`, `benchmarkName`, `scoringMode`, `cases`)
- `scoringMode` is `exact-text`
- `cases` is an array

Out-of-scope in this version:

- no database persistence (history is local JSON file only)
- no background run orchestration
- no streaming
- no retries/backoff system beyond minimal error handling
- no batch execution
- no agent loops

## Scoring/results UI (later)

Scoring details and richer result analysis views beyond current manual-run and file-history pages will be added in later iterations.

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
- The action only uses approved registry metadata (`approvedRepoUrl` + `defaultRef`) for sync operations.
- Safety boundaries for this version:
  - reject unknown benchmark ids
  - reject invalid benchmark id format
  - reject non-allowlisted trust mode entries
  - reject path traversal via resolved-path containment checks
- Sync behavior in this version is intentionally narrow:
  - clone when `benchmarks-cache/<benchmark-id>/` is missing
  - if cache directory already exists, treat it as disposable cache state
  - update existing caches with `git fetch origin <defaultRef> --depth 1` + `git reset --hard FETCH_HEAD` + `git clean -fd`
  - no merge preservation and no local cache edit preservation
  - after clone/update, re-check cache + runtime artifact state for concise sync result messaging
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

