# Chimera Core

Chimera Core is the browser-based host web app for the Chimera benchmark system.

This repository contains only the core Next.js application. Benchmark implementations are planned to live in separate repositories and be loaded through a registry-driven workflow.

## Benchmark registry (v1)

Chimera Core now includes a typed local benchmark registry for UI display and contract shaping.

- The registry stores benchmark metadata plus future loading fields (`repoUrl`, `defaultRef`, `entrypoint`, and trust/status flags).
- Benchmark repositories are external to this repo and are represented by references only.
- Current entries are static local examples used to define the first contract and UI shape.
- No cloning, package installation, benchmark execution, database integration, or model API calls are implemented in this step.

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Then open http://localhost:3000.

