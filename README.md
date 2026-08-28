# Hexframe

A deterministic 2D fighting game with its training instruments built into the game.

The order of work is deliberate: this is a **combat simulator first and a game second**.
The current build carries the Black Belfry campaign slice, its Warden Arena duel variant,
a training grid, one player fighter, the Bell Warden, 29 tagged moves, five deterministic
status systems, three server-persisted loadouts and 25 equippable items. Around
them is the machinery that everything later depends on — a fixed 60 Hz integer
simulation, snapshots, state hashes, rollback, and Training tools that can pause, step,
rewind and inspect it.

## Layout

```
src/combat      the simulation. integers only, no DOM, no clock, no randomness
src/input       input frames, the buffer, and the command parser
src/rollback    serialisation, hashing, the snapshot ring, the rollback session
src/content     JSON → runtime combat data, and the validator that guards the door
src/renderer    SVG. downstream of the simulation and never able to influence it
src/lab         game UI: menus, armory, codex, training timeline, dummy, debug panel
src/game        StageCatalog and the shared GameSession launch contract
src/player      the versioned PlayerSave contract, browser cache, and save client
src/worker      Cloudflare Worker: routing, save authority, developer gate, assets
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

`/` is the public landing page. `/play/` opens the title screen and six-destination main
menu: Campaign, Fight, Training, Armory, Codex, and System. `/training/` launches the same
client through the Training session contract. The retired `/lab` route redirects to
Training; an authenticated operator receives `debug=1`, while an unauthenticated request
is stripped back to ordinary Training. The permanent authoritative-state debugger remains
operator-only, while frame controls, save states, geometry display, dummy behavior, and
scenario capture are normal Training features.

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

None of them reaches the browser. The session secret also signs the opaque player-save
identity cookie. If it is absent, server saves answer `503` and the client continues from
its device cache without treating that cache as authoritative.
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
from authored cancel targets. The three loadouts are also the game's fighter-select
fantasy: Campaign, Fight, and Training launch the selected 16-move build plus equipment.
Gear contains equipped slots, character stats, inventory and item detail. The Moves Codex runs a canonical two-fighter mini-match through the real
`Simulation` for Demo/Hit/Block, with exact 60 Hz frame scrubbing and the authoritative
move timeline; the Status Codex explains primer/payoff routes, while training internals
and hitbox overlays remain separate.

The optional first-launch tutorial is a real game mode rather than a documentation page.
Its movement, defense, direction, modifier, route, status, Arsenal, and Codex lessons
advance from inputs, fighter states, move starts, contacts, and status events. It installs
a temporary deterministic build, saves completion per lesson, and restores the player's
presets unchanged when the tutorial exits.

Every attack has a deterministic presentation profile. The 29 profiles combine authored
fighter clips with distinct elemental colors, particle shapes, orbit counts, sizes,
rotations and motion, while remaining downstream of combat state.

Progress now uses one versioned `PlayerSave`: per-stage campaign state, unlocks, inventory,
and loadouts. A per-player Durable Object is the source of truth and revisions prevent
silent concurrent overwrites. Boss rewards, stage pickups, checkpoints, chests, and
crafting are explicit server operations; Bell Warden rewards are idempotent. The old
campaign/build localStorage keys are read once for migration into the unified cache.

Settings are keyboard/gamepad navigable and deliberately remain device-local. Audio mixing, audio
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

0.1 is the foundation: the deterministic core, rollback, Campaign/Fight/Training launch
contracts, unified saves, armory, gear, status routes, accessibility preferences and the
tagged move catalog. Still to come —
the projectile and throw archetypes, the `MatchRoom` Durable Object, the two-browser
WebSocket match, and the network condition simulator. They are additions on top of this
core, not changes to it.
