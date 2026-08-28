# Licensing review

The MIT licence in `LICENSE` covers the whole distributable work. That is possible because
the licensing surface is unusually small, which was verified rather than assumed:

| Surface | Finding |
| --- | --- |
| Runtime dependencies | **None.** `package.json` declares no `dependencies`. |
| Development dependencies | vite, vitest, typescript, wrangler, ajv, type packages. Build tools; not redistributed. |
| Fonts | Referenced by family name only (`Inter`, with system fallbacks). **No font file is bundled.** |
| Audio | **Synthesized at runtime** from WebAudio oscillators. No audio asset exists in the repository. |
| Art | One file: `characters/test_fighter/model.svg` — 2.9 KB, hand-authored. |
| Icons | None. |
| Third-party snippets | None identified. |
| External asset URLs | None. The only URI in the SVG is the SVG namespace. |

Because no third-party media, font or code is redistributed, source-code licensing covers
the assets here — a conclusion that does **not** generalise to the other WizardGang
projects, each of which needs its own review.

Verify:

```bash
node -e "console.log(require('./package.json').dependencies ?? 'none')"
git ls-files | grep -viE '\.(ts|js|mjs|json|jsonc|md|css|html)$'
```
