# Deployment records

Each record ties one production deployment to one immutable release identity. A record is
written only after `/version.json` has been read back from production and matched against
the release tag's commit.

## DEP-HF-001

**Product:** Hexframe
**Release:** v0.7.0
**Commit:** `cc07fa50763bec3b7f5d403fcded1a0f813aab74`
**Environment:** production
**Date:** 2026-08-28
**URL:** https://hexframe.wizardgang.ai

**Changes:** HF-001 through HF-068 (initial public deployment)

**Validation:** PASS — 144 tests, typecheck, production build, live release identity, public routes,
player save API, login boundary, and developer API authorization.

**Previous:** none — first deployment of this Worker

**Rollback:** none. The prior product deployment (`hexframe.wizardgang.ai`) is a
different Worker on a different origin and is not a rollback target for this one.

**Note:** this is a clean-cut migration. Player saves held by the previous deployment are
not transferred; see [docs/releases/v0.7.0.md](../releases/v0.7.0.md).

---

## DEP-HF-002

**Product:** Hexframe
**Release:** v0.7.1
**Commit:** `40ab986ef35205d72aeff23438097d5d64910392`
**Environment:** production
**Date:** 2026-08-28
**URL:** https://hexframe.wizardgang.ai

**Changes:** HF-070 (public product-identity correction)

**Validation:** PASS — 144 tests, typecheck, production build, `/version.json` matched the
release tag and commit, the live client bundle contained `HEXFRAME` and no former product title,
public play/training/codex/loadout routes resolved, saves returned JSON, `/login` retained its
restricted security policy, and `/api/lab/session` refused an unauthenticated request with 401.

**Previous:** v0.7.0

**Rollback:** Deploy v0.7.0.

**Note:** GitHub Actions reproduced the release successfully. Its deploy job could not authenticate
because repository environment secrets are not configured; the exact tag was deployed and verified
from the authorized local release environment.

---

## Record format

```
## DEP-HF-###

Product / Release / Commit / Environment / Date / URL
Changes:    HF-### through HF-###
Validation: PASS
Previous:   v0.x.0
Rollback:   Deploy v0.x.0
```
