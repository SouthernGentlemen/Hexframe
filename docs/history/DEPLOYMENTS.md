# Deployment records

Each record ties one production deployment to one immutable release identity. A record is
written only after `/version.json` has been read back from production and matched against
the release tag's commit.

## DEP-HF-001

**Product:** Hexframe
**Release:** v0.7.0
**Commit:** _pending — recorded after the first deployment_
**Environment:** production
**Date:** _pending_
**URL:** https://hexframe.wizardgang.ai

**Changes:** HF-001 through HF-068 (initial public deployment)

**Validation:** _pending_

**Previous:** none — first deployment of this Worker

**Rollback:** none. The prior product deployment (`hexframe.wizardgang.ai`) is a
different Worker on a different origin and is not a rollback target for this one.

**Note:** this is a clean-cut migration. Player saves held by the previous deployment are
not transferred; see [docs/releases/v0.7.0.md](../releases/v0.7.0.md).

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
