# Benchmark CLI Contract (v1, minimal)

This document defines the shared **CLI transport contract** for benchmark repos that expose a local CLI entrypoint.

Current reference implementation: `state-trace` cached CLI pilot. Treat it as a proven example, not a hard-coded one-off.

## Purpose

- Keep Core-to-benchmark CLI calls consistent.
- Keep payloads small, JSON-only, and easy to debug.
- Define only what is needed now (`describe`, `generate`, `score`, `analyze`).
- Keep benchmark discovery practical by exposing a small `describe` shape.

## Transport

- Command is passed as a positional CLI arg: `describe`, `generate`, `score`, or `analyze`.
- Request payload is JSON over `stdin`.
- Success payload is JSON on `stdout`.
- Human/debug logs go to `stderr`.

Core should treat non-zero exit, empty stdout, or invalid JSON stdout as a command failure.

## Common envelope fields

All request payloads include:

- `benchmarkId`: benchmark identifier (for routing/validation in the benchmark CLI)
- `contractVersion`: contract version string (currently `"1"`)

## Commands

### `describe`

Purpose:

- Give Core a minimal benchmark-owned description of what this CLI supports.
- Give Core a small input shape for `generate` without standardizing full benchmark internals.

Practical response shape:

```json
{
  "benchmarkId": "state-trace",
  "contractVersion": "1",
  "displayName": "State Trace",
  "description": "Follow state transitions and return the final value.",
  "commands": {
    "generate": {
      "fields": [
        {
          "name": "seed",
          "type": "string",
          "required": true,
          "description": "Deterministic seed for instance generation"
        },
        {
          "name": "stepCount",
          "type": "integer",
          "required": true,
          "min": 1,
          "max": 200
        },
        {
          "name": "difficulty",
          "type": "select",
          "required": false,
          "options": [
            { "value": "easy", "label": "Easy" },
            { "value": "normal", "label": "Normal" },
            { "value": "hard", "label": "Hard" }
          ]
        },
        {
          "name": "includeNoise",
          "type": "boolean",
          "required": false,
          "default": false
        }
      ]
    },
    "score": {},
    "analyze": {}
  }
}
```

`generate.fields` is the initial benchmark-provided input description surface.

Field definition shape (v1, intentionally small):

- `name`: field key submitted in generate input
- `type`: `string` | `integer` | `select` | `boolean`
- `required`: boolean
- optional `description`
- optional `default`
- optional integer bounds: `min`, `max` (for `integer`)
- optional `options` (for `select`): array of `{ value, label }`

Notes:

- `boolean` is included in v1 to avoid ad-hoc yes/no string fields.
- This section is intentionally minimal and may expand as more benchmarks integrate.

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

