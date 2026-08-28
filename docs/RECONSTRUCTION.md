# Historical reconstruction

<!-- SHARED WIZARDGANG TEMPLATE. Replace Hexframe, HF, `SouthernGentlemen/Hexframe` per project. -->

## Declaration

This public repository history was reconstructed from the original private development
repository, deployed artifacts, tests, and production state.

Historical implementation was decomposed into reviewable changes to create a reproducible
public engineering record.

**The reconstructed commit structure does not assert that each public commit originally
existed as an independent Git commit.**

Original source commits and dates are retained in `docs/history/CHANGE-MAP.csv`.

## What was reconstructed, and from what

| Input | Role |
| --- | --- |
| ``SouthernGentlemen/Hexframe`` | Original private implementation history. Immutable provenance; not rewritten. |
| Deployed production artifacts | Evidence of what actually runs |
| Test suite | Evidence of intended and verified behavior |
| Schemas and content | Evidence of authored data contracts |

## Reconstruction method

Reconstruction is **temporal across source commits** and **spatial within them**.

1. **Temporal.** Source commits are replayed in their original order. A reconstructed
   change takes its file content from the source commit that introduced that capability —
   not from the final tree. This prevents later behavior leaking into earlier history.

2. **Spatial.** Where one source commit contained many independent architectural
   components, it is decomposed along the module import graph in topological order. A
   reconstructed commit may only depend on modules introduced by earlier reconstructed
   commits, which is what keeps every intermediate state type-checkable and testable.

3. **Tests travel with their subject.** A test is introduced by the change that completes
   the last dependency the test requires, so no commit ships a test that cannot run.

### Superseded implementations

Where the source history introduced a module and later replaced it, the reconstruction
**reproduces the supersession explicitly** as its own controlled change, because the
superseded design was itself deployed and is therefore part of the real record. Deleting
it from history would misrepresent what production ran.

Consolidation is reserved for source commits that carry no distinct deployed behavior of
their own — a follow-up commit minutes later that completes a single intent, or a
correction to a change that has not yet been released. Those are recorded with
`mapping_type=consolidated` naming every contributing source SHA.

## Mapping types

| Type | Meaning |
| --- | --- |
| `direct` | One source commit maps 1:1 to one public change |
| `decomposed` | One source commit contributed to several public changes |
| `consolidated` | Several source commits contributed to one public change |
| `reconstructed-from-deployment` | Behavior evidenced by the deployed system rather than by a single source commit |

## Timestamps

No historical timestamp is fabricated.

- A change mapping 1:1 to an original commit may preserve the original author date.
- A change decomposed out of a larger commit carries the **reconstruction date**, because
  asserting an earlier date would imply an independent commit that never existed.
- `docs/history/CHANGE-MAP.csv` is the source of truth for original implementation timing.

## Auditing this reconstruction

Every public change resolves in both directions:

```
live software → release → tag → commit SHA → change ID → reason / risk / validation
              → source commit
```

```
source / requirement → controlled change → tested commit → release → deployment
                     → live version
```

## Hexframe specifics

### Product identity

The source repository's product was named *Hexframe*. The public product is **Hexframe**.
The reconstruction therefore carries the Hexframe identity from `HF-001` onward; the former
name survives only as provenance in this document and in `docs/history/CHANGE-MAP.csv`.

This is a rename of identity, not of behaviour. Where the former name appeared in persisted
state keys, the reconstruction uses Hexframe keys:

| Former | Reconstructed |
| --- | --- |
| `hexframe.preferences.v1` | `hexframe.preferences.v1` |
| `hexframe.player-save.v2` | `hexframe.player-save.v2` |
| `hf_player` cookie | `hf_player` cookie |

Hexframe is deployed as a new Worker on a new origin. Browser storage and cookies are
origin-scoped, so no prior local state can be present for the reconstruction to migrate,
and the source project's legacy-key migration path is therefore not carried forward.
Player saves held by the former deployment are **not** transferred. This is a deliberate
pre-1.0 decision and is stated in the release notes rather than left implicit.

### Reconstruction fidelity

`HF-017` completes v0.1.0 and its tree is **byte-identical** to source commit `842eac0`
with the identity transform applied — verified by tree comparison, not by inspection.

Every reconstructed commit was checked out in isolation and independently type-checked,
tested and built. No commit in this history is known to be broken.
