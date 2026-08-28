# Hexframe

A deterministic 2D fighting-game simulator, and the laboratory used to build it.

The order of work is deliberate: this is a **combat simulator first and a game second**.
The first build carries one stage, one fighter, one dummy and one real move, and around
them the machinery that everything later depends on — a fixed 60 Hz integer simulation,
snapshots, state hashes, rollback, and a lab that can pause, step, rewind and inspect it.

## Layout

```
src/combat      the simulation. integers only, no DOM, no clock, no randomness
src/input       input frames, the buffer, and the command parser
src/rollback    serialisation, hashing, the snapshot ring, the rollback session
src/content     JSON → runtime combat data, and the validator that guards the door
src/renderer    SVG. downstream of the simulation and never able to influence it
src/lab         the laboratory: timeline, dummy, debug panel
src/worker      Cloudflare Worker: routing, the /lab session gate, static assets
characters/     authored content, in world pixels and frames
schemas/        JSON Schema for every content type
tests/          simulation, determinism, rollback, collision, move and content suites
docs/           CONTRACTS.md — the module surface every part is written against
```

## Running it

```bash
npm install
cp .env.example .dev.vars   # then fill in the three ADMIN_* values
npm run dev                 # vite build, then wrangler dev on :8788
```

`/` is the public shell. `/lab` is private: the Worker checks a signed session cookie and
sends you to `/login` if you have not got one. Nothing under `/lab` is served until that
check passes.

```bash
npm test          # simulation, determinism, rollback, collision, move, input, content
npm run typecheck
```

## Credentials

Three values, by the same names in every environment:

| name | local (`.dev.vars`) | production |
|---|---|---|
| `ADMIN_USERNAME` | yes | `wrangler secret put ADMIN_USERNAME` |
| `ADMIN_PASSWORD` | yes | `wrangler secret put ADMIN_PASSWORD` |
| `ADMIN_SESSION_SECRET` | yes | `wrangler secret put ADMIN_SESSION_SECRET` |

None of them reaches the browser. If any is missing the protected routes answer `503`
and name the one that is absent — they never fall open and never fall back to a default.
`.env`, `.env.*` and `.dev.vars` are ignored by git.

## The two rules worth restating

**Visual data is not combat data.** Changing a torso lean in `characters/*/animations/`
cannot change damage, startup or a hitbox, because the simulation never reads an
animation. It reads `characters/*/moves/`.

**Rendering is downstream.** Nothing under `src/renderer` or `src/lab` may decide game
state. The simulation runs at a fixed 60 frames per second on integers, and the browser's
refresh rate, `deltaTime`, and floating-point maths are kept out of it entirely — because
a rollback that re-runs the same frames has to land on the same bits.

## Not here yet

0.1 is the foundation: the deterministic core, rollback, the lab, and one move. Still to
come — the projectile and throw archetypes, the `MatchRoom` Durable Object, the two-browser
WebSocket match, and the network condition simulator. They are additions on top of this
core, not changes to it.
