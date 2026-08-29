# Historical reconstruction

<!-- SHARED WIZARDGANG TEMPLATE. Replace Hexframe, HF, and the predecessor repository per project. -->

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
| `SouthernGentlemen/ShadowMoney` | Original private implementation history. Retired after the reconstruction; its source SHAs remain the immutable provenance identifiers. |
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

The source repository's product was named *ShadowMoney*. The public product is
**Hexframe**. The reconstruction therefore carries the Hexframe identity from `HF-001`
onward; the former name survives only where it is needed for provenance and for the
path-preserving retirement boundary documented in `docs/SHADOWMONEY-RETIREMENT.md`.

This is a rename of identity, not of behaviour. Where the former name appeared in persisted
state keys, the reconstruction uses Hexframe keys:

| Former | Reconstructed |
| --- | --- |
| `shadowmoney.preferences.v1` | `hexframe.preferences.v1` |
| `shadowmoney.player-save.v2` | `hexframe.player-save.v2` |
| `sm_player` cookie | `hf_player` cookie |

Hexframe is deployed as a new Worker on a new origin. Browser storage and cookies are
origin-scoped, so no prior local state can be present for the reconstruction to migrate,
and the source project's legacy-key migration path is therefore not carried forward.
Player saves held by the former deployment are **not** transferred. The retired Worker
keeps its original Durable Object class export so those saves are preserved without being
made reachable from Hexframe. This is a deliberate pre-1.0 decision and is stated in the
release notes rather than left implicit.

### Reconstruction fidelity

`HF-017` completes v0.1.0 and its tree is **byte-identical** to source commit `842eac0`
with the identity transform applied — verified by tree comparison, not by inspection.

Every reconstructed commit was checked out in isolation and independently type-checked,
tested and built. No commit in this history is known to be broken.

### Repairs folded forward

The source history was **not green at every commit**. Measured by checking out each source
commit and running its own toolchain:

| Source commit | Type errors | Failing tests |
| --- | --- | --- |
| `77552ba` | 0 | 2 |
| `21ee03e` | 4 | 2 |
| `351f48f` | 13 | 2 |
| `dd71145` | 0 | 0 |

The final source commit, *"Fix validation regressions in cleanup pass"*, repaired defects
introduced across the preceding six commits.

Reproducing that faithfully would mean publishing six commits that are known not to build
or pass, which the change standard forbids. The reconstruction therefore **introduces the
repaired form of each affected file in the change that introduces the file**, rather than
adding a later corrective change:

| File | Repaired in | Folded into |
| --- | --- | --- |
| `tests/simulation/advanced-combat.test.ts` | `dd71145` | HF-059 |
| `tests/simulation/team-combat.test.ts` | `dd71145` | HF-059 |
| `src/client/campaign-menu-cleanup.ts` | `dd71145` | HF-060 |
| `tests/renderer/character-presentation.test.ts` | `dd71145` | HF-062 |

`dd71145` is recorded in `CHANGE-MAP.csv` against each of those changes with
`mapping_type=consolidated`. No defect reaches a public commit, and nothing is concealed:
the source's own repair commit is named here and in the provenance map.

This applies only to defects that were **never released**. A defect that reaches a
published release is corrected forward under its own change ID, as
`docs/CHANGE-MANAGEMENT.md` and `SECURITY.md` require.

## Verification of this reconstruction

Every claim below is reproducible from this repository.

**Every commit is independently sound.** Each of the 62 reconstructed source commits was
checked out in isolation and independently type-checked, tested and built.

**The end state matches the source exactly.** The tree at `HF-062` is byte-identical to
source commit `dd71145` with the identity transform applied, except for this file and
`docs/history/`. Both trees pass the same 140 tests across 33 files.

**Release boundaries match real product states.** Each release tag corresponds to a source
commit whose tree the reconstruction reproduces:

| Release | Reconstructed state equals source commit |
| --- | --- |
| `v0.1.0` | `842eac0` |
| `v0.2.0` | `c892ea2` |
| `v0.3.0` | `fb5f6a5` |
| `v0.4.0` | `1ef855f` |
| `v0.5.0` | `c6d74e8` |
| `v0.6.0` | `dd71145` |

`v0.7.0` has no source equivalent: it is the engineering record, CI, deployment identity
and licence added by this program.

## What the reconstruction changed on purpose

| Change | Reason |
| --- | --- |
| Product renamed to Hexframe throughout | The public product identity. See "Product identity" above. |
| Storage keys and the identity cookie renamed | They are part of the product identity, and the new origin has no prior state to migrate. |
| Legacy-key migration not carried forward | Unreachable on a new origin; keeping it would be dead code implying a history Hexframe does not have. |
| `vite.config.ts` staged at `HF-001` | The foundation commit must name only pages that exist. |
| `README.md` purpose-written at `HF-001` | The source README described a finished prototype at a commit that was not one. |
| Repairs folded forward | See "Repairs folded forward" above. |

Nothing else in the reconstructed source tree differs from the original implementation.
