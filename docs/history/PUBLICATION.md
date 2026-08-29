# Publication records

## PUB-HF-001

**Repository:** https://github.com/SouthernGentlemen/Hexframe  
**Visibility:** public  
**Date:** 2026-08-28  
**Production:** https://hexframe.wizardgang.ai  
**Published release:** v0.7.2 at `e134f5fc9f69bbf76f21a4c0fb62556f60629d39`

Hexframe is the canonical public source, release, deployment, and retirement-boundary
repository. The predecessor `SouthernGentlemen/ShadowMoney` repository is retired and no
longer resolves on GitHub. Its functional implementation through `dd71145` is represented
by the reconstructed Hexframe history, and its final retirement changes (`aea19b9` and
`5f3be31`) are consolidated into HF-093.

### Pre-publication verification

- The tracked tree and every reachable Git commit were scanned for credential material.
  Matches were limited to deliberate test fixtures and CI secret-variable references.
- Every release ref from v0.1.0 through v0.7.2 is an annotated tag.
- `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` passed at the published
  v0.7.2 state; the suite contained 148 passing tests across 35 files.
- `npm ci` reported zero known vulnerabilities.
- Production `/version.json` matched v0.7.2 and its exact tagged commit.
- Public `/play/`, `/training/`, and `/api/save` resolved; protected `/`, `/lab`, and
  `/codex/` entered the empty-body login redirect; an unauthenticated lab API request was
  rejected with `401`.
- `shadowmoney.wizardgang.ai` returned a bodyless, path- and query-preserving `308` to the
  Hexframe origin with the recorded retirement security headers.
- The WizardGang portfolio project page resolved and linked to the Hexframe product.

### Repository controls

- Secret scanning and push protection are enabled.
- Dependency vulnerability alerts, automated security fixes, and private vulnerability
  reporting are enabled.
- `main` requires a pull request, current CI checks, resolved conversations, and
  administrator enforcement; force pushes and deletion are disabled.
- The `production` environment only accepts protected branches and requires an explicit
  reviewer. Its production host and Cloudflare account identity are configured.

### Deployment automation limitation

The exact v0.7.2 tag was deployed and verified from the authorized local release
environment. The GitHub deployment job reproduced the tag but could not authenticate
because no scoped `CLOUDFLARE_API_TOKEN` is available in the repository environment. The
token is intentionally not copied from local OAuth credentials. Until an authorized
scoped token is provisioned, release deployments must continue through the documented
local release environment and be verified against `/version.json`.

The v0.7.2 release job also exposed a tag-fetch defect: checkout reproduced the commit but
did not retain the annotated tag object used by the guard. HF-095 corrects that guard for
future releases; existing tag and release identities are unchanged.
