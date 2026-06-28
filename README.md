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

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Then open http://localhost:3000.

