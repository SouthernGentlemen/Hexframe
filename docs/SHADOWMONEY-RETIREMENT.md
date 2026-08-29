# ShadowMoney retirement boundary

Hexframe owns the permanent compatibility boundary for the retired ShadowMoney product.
`shadowmoney.wizardgang.ai` returns a path- and query-preserving `308` redirect to
`hexframe.wizardgang.ai`; it does not serve the former application or forward request
credentials.

## Canonical implementation

- Worker entry: `src/worker/shadowmoney-retirement.ts`
- Cloudflare configuration: `wrangler.shadowmoney-retirement.jsonc`
- Contract tests: `tests/worker/shadowmoney-retirement.test.ts`
- Deployment command: `npm run deploy:shadowmoney-retirement`

The compatibility Worker deliberately exports `PlayerSaveObject` while exposing no
Durable Object binding. Cloudflare therefore retains the former Worker's stored save
namespace without making it reachable through the redirect. Removing that export or its
existing migration requires a separately reviewed destructive-data decision.

## Source provenance

The retirement behavior was consolidated from the final two ShadowMoney source commits:

- `aea19b9` — replace the application at the former hostname with the fixed redirect.
- `5f3be31` — preserve the retired save-object class export.

The original repository is retired. These source identifiers, the implementation above,
and `docs/history/CHANGE-MAP.csv` keep the retirement boundary reproducible from the public
Hexframe repository.

## Verification

Before and after a retirement deployment, verify at minimum:

```bash
curl -I 'https://shadowmoney.wizardgang.ai/'
curl -I 'https://shadowmoney.wizardgang.ai/training/?mode=training'
```

Both responses must be `308`, point to the same path and query on
`https://hexframe.wizardgang.ai`, and include the retirement security headers. Also verify
that `https://hexframe.wizardgang.ai/version.json` still names the intended Hexframe
release; the two Workers have separate deployment identities.

## Rollback

Redeploy the last known-good retirement boundary from its Hexframe release tag. Do not
restore the ShadowMoney application as an ordinary rollback: Hexframe is the canonical
product and the old save namespace is preserved only for recovery.
