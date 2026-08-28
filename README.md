# Hexframe

A deterministic 2D fighting-game architecture.

The simulation is fixed-step, integer-only and authoritative: one frame of inputs in, one
frame of state out, with no clock read and no ambient randomness. Rendering, tooling and
transport are all downstream of it.

## Run locally

```bash
npm ci
npm run dev
```

## Verify

```bash
npm run typecheck
npm run build
```

## Engineering record

This public history was reconstructed. See [docs/RECONSTRUCTION.md](docs/RECONSTRUCTION.md)
and [docs/history/CHANGE-MAP.csv](docs/history/CHANGE-MAP.csv) for provenance, and
[docs/CHANGE-MANAGEMENT.md](docs/CHANGE-MANAGEMENT.md) for how changes are identified,
classified and validated.
