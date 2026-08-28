# Hexframe

A deterministic 2D fighting-game simulator, and the laboratory used to build it.

The order of work is deliberate: this is a **combat simulator first and a game second**.
The current build carries one stage, one fighter, one dummy, 28 tagged moves, five
deterministic status systems, three persistent loadouts and 25 equippable items. Around
them is the machinery that everything later depends on — a fixed 60 Hz integer
simulation, snapshots, state hashes, rollback, and a lab that can pause, step, rewind and
inspect it.

## Layout

```
src/combat      the simulation. integers only, no DOM, no clock, no randomness
src/input       input frames, the buffer, and the command parser
src/rollback    serialisation, hashing, the snapshot ring, the rollback session
src/content     JSON → runtime combat data, and the validator that guards the door
src/renderer    SVG. downstream of the simulation and never able to influence it
src/lab         the laboratory: timeline, armory, settings, dummy, debug panel
src/worker      Cloudflare Worker: routing, the /lab session gate, static assets
characters/     authored content, in world pixels and frames
schemas/        JSON Schema for every content type
tests/          simulation, determinism, rollback, collision, move and content suites
docs/           CONTRACTS.md — the module surface every part is written against
```

## Running it

```bash
npm install
cp .env.example .env        # then fill in the account id and three ADMIN_* values
npm run dev                 # vite build, then wrangler dev on :8788
```

`/` is the public shell and `/play/` is the public, game-first playtest. `/lab` is private:
the Worker checks a signed session cookie and sends you to `/login` if you have not got
one. Nothing under `/lab` is served until that check passes. The two combat routes share
one simulator and browser bundle, but only the lab renders the permanent debugger,
geometry controls, interaction history, and scenario tools.

```bash
npm test          # simulation, determinism, rollback, collision, move, input, content
npm run typecheck
```

## Credentials

Three values, by the same names in every environment:

| name | local (`.env`) | production |
|---|---|---|
| `ADMIN_USERNAME` | yes | synchronized by the deploy script |
| `ADMIN_PASSWORD` | yes | synchronized by the deploy script |
| `ADMIN_SESSION_SECRET` | yes | synchronized by the deploy script |

None of them reaches the browser. If any is missing the protected routes answer `503`
and name the one that is absent — they never fall open and never fall back to a default.
`.env`, `.env.*` and `.dev.vars` are ignored by git. `npm run deploy` reads the root
`.env`, deploys to the selected Cloudflare account, and synchronizes the three admin
values as Worker secrets.

## Controls and move building

Movement is WASD or the left stick/D-pad. The arrow-key diamond maps spatially to
Y/X/B/A. Direction chooses a status route: up is Fire, left is Poison, right is Freeze,
and down is Shock. Shift or LT advances to the Link bank, E or RT advances to Cashout,
and holding both selects the utility row: four route columns and 16 independent action
inputs in total. The Arsenal renders that exact 4×4 layout, can equip an authored route
from the Codex in one action, and persists the player's builds locally.

The combo graph is authored rather than fully connected. Status primers are starters,
their same-family follow-ups are links, and links reach only matching cashouts. Starters
may pivot into another starter to reprime a route; cashouts and reversals end it. The
catalog and Status Codex expose those role tags, and tests pin the five showcased routes.

The Armory separates Loadout and Gear so neither screen has competing nested panels.
Loadout arms one of the 16 action slots, equips directly from a controller-navigable
filtered catalog, shows duplicate-aware equipped locations, and derives route completeness
from authored cancel targets. Gear contains equipped slots, character stats, inventory and
item detail. The Moves Codex runs a canonical two-fighter mini-match through the real
`Simulation` for Demo/Hit/Block, with exact 60 Hz frame scrubbing and the authoritative
move timeline; the Status Codex explains primer/payoff routes, while training internals
and hitbox overlays remain separate.

The optional first-launch tutorial is a real game mode rather than a documentation page.
Its movement, defense, direction, modifier, route, status, Arsenal, and Codex lessons
advance from inputs, fighter states, move starts, contacts, and status events. It installs
a temporary deterministic build, saves completion per lesson, and restores the player's
presets unchanged when the tutorial exits.

Every attack has a deterministic presentation profile. The 28 profiles combine authored
fighter clips with distinct elemental colors, particle shapes, orbit counts, sizes,
rotations and motion, while remaining downstream of combat state.

Settings are also keyboard/gamepad navigable and persist locally. Audio mixing, audio
captions, visual-effect reduction, reduced motion, text scaling, high contrast, color
vision palettes, status patterns, dyslexia-friendly type, strong focus indicators,
screen-reader combat announcements, deadzone and vibration controls all have explicit
user-facing controls. System motion preferences are honored by default.

## The two rules worth restating

**Visual data is not combat data.** Changing a torso lean in `characters/*/animations/`
cannot change damage, startup or a hitbox, because the simulation never reads an
animation. It reads `characters/*/moves/`.

**Rendering is downstream.** Nothing under `src/renderer` or `src/lab` may decide game
state. The simulation runs at a fixed 60 frames per second on integers, and the browser's
refresh rate, `deltaTime`, and floating-point maths are kept out of it entirely — because
a rollback that re-runs the same frames has to land on the same bits.

## Not here yet

0.1 is the foundation: the deterministic core, rollback, the armory/training lab, gear,
status routes, accessibility preferences and the tagged move catalog. Still to come —
the projectile and throw archetypes, the `MatchRoom` Durable Object, the two-browser
WebSocket match, and the network condition simulator. They are additions on top of this
core, not changes to it.
