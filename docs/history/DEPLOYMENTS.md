# Deployment records

<!-- SHARED WIZARDGANG TEMPLATE. Deployment IDs use DEP-HF-###. -->

Each record ties one production deployment to one immutable release identity.

## Record format

```
## DEP-HF-###

Product:
Hexframe

Release:
v0.x.0

Commit:
<sha>

Environment:
production

Date:
YYYY-MM-DD

URL:
https://<host>

Changes:
HF-### through HF-###

Validation:
PASS

Previous:
v0.x.0

Rollback:
Deploy v0.x.0
```

A deployment record is only written after the deployed `/version.json` has been read back
from production and matched against the release tag SHA.
