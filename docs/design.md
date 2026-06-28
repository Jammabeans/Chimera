# Chimera v1 Design Summary

## Core app

This repo is the core browser app that hosts benchmark execution and result presentation flows.

## External benchmark repos

Benchmark implementations are not stored here. They will live in separate repositories and be referenced by this app.

## Registry-driven loading

The core app will use a registry model to discover and load benchmark definitions/providers from external sources.

### Registry contract (v1)

The first typed registry contract is defined in core code and currently backed by static local examples.

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

- Entries are displayed in the core UI as static data.
- `repoUrl`/`defaultRef`/`entrypoint` fields exist to support future external-repo loading.
- No cloning, install, dynamic loading, execution, persistence, or provider/API calls are included yet.

## Scoring/results UI (later)

Scoring details, run history, and richer results views will be added in later iterations.

