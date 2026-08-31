# ShadowMoney decommission record

ShadowMoney was the private predecessor to Hexframe. Its compatibility Worker previously
returned a path- and query-preserving `308` redirect from `shadowmoney.wizardgang.ai` to
`hexframe.wizardgang.ai` while retaining the former `PlayerSaveObject` namespace.

On 2026-08-31, an explicitly authorised destructive-data decision ended that boundary.
The `shadowmoney` Worker, custom domain, DNS route, and Durable Object namespace were
deleted. The former hostname no longer resolves to an application, and predecessor player
saves are no longer retained or recoverable. Hexframe and its own `PlayerSaveObject`
namespace were not changed.

The obsolete Worker entry, deployment script, Cloudflare configuration, and contract test
were removed under HF-112 so the current tree cannot accidentally recreate the retired
runtime.

## Source provenance

The retirement behavior was consolidated from the final two ShadowMoney source commits:

- `aea19b9` — replace the application at the former hostname with the fixed redirect.
- `5f3be31` — preserve the retired save-object class export.

The original repository is retired. These source identifiers, the public Git history, the
v0.7.3 release record, and `docs/history/CHANGE-MAP.csv` preserve the provenance of the
former retirement boundary without keeping it deployable in the current tree.

## Verification

The decommission is verified by the Cloudflare account inventory and public DNS:

```bash
dig +short shadowmoney.wizardgang.ai A
dig +short shadowmoney.wizardgang.ai AAAA
dig +short shadowmoney.wizardgang.ai CNAME
```

All three DNS queries return no answer. The Cloudflare inventory contains no `shadowmoney`
Worker, custom domain, DNS record, or Durable Object namespace. It still contains the
`hexframe` Worker, custom domain, and `hexframe_PlayerSaveObject` namespace.

## Recovery boundary

The deleted Durable Object data cannot be rolled back. Git history preserves the former
redirect implementation for audit purposes, but recreating any ShadowMoney runtime or
hostname would be a new controlled infrastructure change. Hexframe remains the canonical
product and recovery target.
