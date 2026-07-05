# Benchmark CLI Contract (v1, minimal)

This document defines the shared **CLI transport contract** for benchmark repos that expose a local CLI entrypoint.

Current reference implementation: `state-trace` cached CLI pilot. Treat it as a proven example, not a hard-coded one-off.

## Purpose

- Keep Core-to-benchmark CLI calls consistent.
- Keep payloads small, JSON-only, and easy to debug.
- Define only what is needed now (`generate`, `score`, `analyze`).

## Transport

- Command is passed as a positional CLI arg: `generate`, `score`, or `analyze`.
- Request payload is JSON over `stdin`.
- Success payload is JSON on `stdout`.
- Human/debug logs go to `stderr`.

Core should treat non-zero exit, empty stdout, or invalid JSON stdout as a command failure.

## Common envelope fields

All request payloads include:

- `benchmarkId`: benchmark identifier (for routing/validation in the benchmark CLI)
- `contractVersion`: contract version string (currently `"1"`)

## Commands

### `generate`

Practical request shape:

```json
{
  "benchmarkId": "state-trace",
  "contractVersion": "1",
  "seed": "seed-123",
  "params": {
    "stepCount": 12
  }
}
```

Practical response shape:

```json
{
  "prompt": "...",
  "instance": {
    "...": "benchmark-defined"
  }
}
```

Generated instance expectations:

- `instance` is benchmark-owned opaque JSON for later `score`/`analyze` calls.
- Core stores/transports it without mutating semantic fields.

### `score`

Practical request shape:

```json
{
  "benchmarkId": "state-trace",
  "contractVersion": "1",
  "instance": {
    "...": "from generate"
  },
  "response": {
    "text": "user or model answer"
  }
}
```

Practical response shape:

```json
{
  "correct": true,
  "score": 1,
  "...": "benchmark-defined extra fields allowed"
}
```

### `analyze`

Practical request shape is the same envelope style as `score`.

Practical response shape is benchmark-defined analysis JSON and should be safe for Core to render as data.

## Error behavior

- CLI validation/runtime failures should return non-zero exit.
- Error details should be written to `stderr`.
- Core should surface command name + stderr context in operator-facing errors.

## Current non-goals (intentionally undefined)

- Full canonical schema for benchmark-specific `instance` internals.
- Global standard for analysis taxonomy/report formatting.
- Provider/model execution behavior in benchmark CLI.
- Streaming/interactive protocols.
- Version negotiation beyond sending `contractVersion`.

