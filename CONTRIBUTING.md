# Contributing

<!-- SHARED WIZARDGANG TEMPLATE. Replace Hexframe, HF. -->

## Change flow

```
change requirement → permanent change ID → branch → implementation → PR → CI
                   → review → merge → release → production
```

## Branch naming

```
hf/HF-063-short-slug
```

## Commit and PR titles

```
[HF-063] [FEAT] Add deterministic projectile entities
```

One primary type per change. See [docs/CHANGE-MANAGEMENT.md](docs/CHANGE-MANAGEMENT.md)
for the full type list, body format, and risk definitions.

## Before opening a pull request

```bash
npm ci && npm test && npm run typecheck && npm run build
```

No green CI, no merge.

## Rules that are not negotiable

- `main` is protected. No direct pushes, no force pushes, linear history only.
- Published release tags are never moved or deleted.
- No credential ever enters the repository, its history, its tests, or its documentation.
- A reverted change keeps its ID; the revert receives a new one.
- A corrective change names what it corrects with a `Corrects:` line.
