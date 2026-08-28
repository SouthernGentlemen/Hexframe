# Hexframe

Hexframe is a deterministic 2D fighting game built around authored loadouts, party AI, a single-player campaign, and first-class training tools.

The current vertical slice includes Black Belfry, its Warden Arena fight variant, the Training Grid, one player fighter, the Bell Warden, 29 tagged techniques, deterministic status systems, three server-persisted loadouts, equipment/crafting, and a fixed 60 Hz integer simulation with snapshots, hashes, and rollback infrastructure.

## Player flow

`/` is the title screen. `/play/` is the main menu with five player-facing destinations:

- **Continue** — enter the current Black Belfry campaign checkpoint.
- **Fight** — build a party from one human loadout plus up to two AI loadout slots, choose AI difficulty, and face the current encounter.
- **Training** — choose a loadout, run the tutorial, or enter the integrated training environment.
- **Loadouts** — edit the three 16-technique builds used by both human and AI slots. Forge is linked from this route.
- **Codex** — inspect moves, statuses, enemies, and stages.

Settings and player profile data are global controls rather than a sixth menu destination.

The public front end uses clean routed screens:

```text
/
/play/
/campaign/
/fight/
/training/
/loadouts/
/loadouts/:id/
/forge/
/codex/
/codex/moves/:id/
/codex/status/:id/
/codex/enemies/bell-warden/
/codex/stages/black-belfry/
/settings/
```

The retired Lab concept is folded into Training. `/lab/` remains a compatibility/authentication route and authenticated operator tooling is exposed through Training developer mode; ordinary players get the normal Training surface.

## Core architecture

```text
src/combat      deterministic simulation; integers only, no DOM or wall clock
src/input       input frames, history, buffering, command parsing
src/rollback    snapshots, hashing, replay, rollback session
src/content     authored gameplay and presentation content
src/renderer    SVG presentation; always downstream of simulation
src/game        StageCatalog, GameSession, party slots, deterministic loadout AI
src/player      versioned PlayerSave contract, cache, server save client
src/client      title/front-end route shell and browser entrypoints
src/lab         in-match UI plus integrated Training/debug instrumentation
src/worker      Cloudflare routing, save authority, auth gates, static assets
characters/     authored fighter rig/animation/move content
schemas/        JSON schemas for authored content
 tests/         simulation, rollback, input, content, AI, renderer and worker suites
```

Two rules are load-bearing:

**Visual data is not combat data.** Rig poses, animations, particles, telegraphs, and SVG changes cannot change damage, startup, hitboxes, movement, or authoritative state.

**Rendering is downstream.** The simulation runs on a fixed 60 Hz integer clock. Browser refresh rate and presentation interpolation cannot influence rollback state.

## Sessions and parties

A `GameSession` launches Campaign, Fight, or Training through a shared contract:

```text
mode
party[]
encounterId
stageId
options
```

A party slot contains a controller type and a loadout. Slot 1 is human; Fight and Campaign can add up to two AI slots. AI uses the same authored loadouts as the player rather than a separate hidden moveset.

The deterministic `LoadoutAIController` reasons from authored move roles and combat state: starter/link/cashout tags, cancel windows, status stacks, stamina, range, defensive threat, spacing, and difficulty. It owns no ambient random state; tie-breaking and mistakes are derived from authoritative frame/seed inputs.

Current AI difficulties change reaction delay, threat prediction, route depth, defensive consistency, spacing accuracy, offensive choice breadth, mistake frequency, and aggression. They do not modify fighter stats or authored damage.

## Stages

The StageCatalog currently exposes three launchable stage definitions:

- `black-belfry-campaign` — scrolling campaign traversal with breakables, hazards, automatic checkpoint, chest, boss gate, and boss reward.
- `black-belfry-arena` — compact duel-only Warden Arena with campaign traversal removed.
- `training-grid` — neutral deterministic training space.

Black Belfry no longer uses Forge or Arsenal Shrine objects as menu navigation. Loadouts and Forge are global routes; stage interactions are reserved for actual world actions.

## Training

Training is part of the game rather than a separate product. Normal tools include dummy behavior, recording/playback, reversals/counterattacks, frame transport, save/load state, geometry display, interaction history, and scenario capture/replay. Permanent authoritative developer instrumentation remains operator-gated.

## Saves

Progress uses one versioned `PlayerSave` containing campaign stage state, unlocks, inventory, and loadouts. A per-player Durable Object is the server source of truth and revisions protect against silent concurrent overwrites. Browser storage is a cache/migration surface, not the authority.

Boss rewards and crafting are server operations. Bell Warden completion/reward mutation is idempotent.

Device-specific preferences such as audio, accessibility, visual settings, deadzone, and vibration remain local.

## Presentation

The player and Bell Warden use independent SVG rigs and animation sets. Bell Warden no longer reuses the player skeleton.

Technique VFX are authored per move with named anchors and exact presentation windows. Effects can anchor to hands, feet, torso, pelvis, ground, or hitbox centers, while actual contact bursts use the collision contact coordinates emitted by the simulation. Presentation remains non-authoritative.

## Running locally

```bash
npm install
cp .env.example .env
npm run dev
```

Then use:

```bash
npm test
npm run typecheck
npm run build
```

## Credentials

Local and production environments use the same secret names:

| Name | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | Operator login |
| `ADMIN_PASSWORD` | Operator login |
| `ADMIN_SESSION_SECRET` | Operator/player-save session signing |

Secrets never ship to the browser.

## Current scope

The current build is still foundational. Network matches, the MatchRoom Durable Object, two-browser WebSocket play, projectiles/throws as complete gameplay archetypes, additional stages, and additional fighters remain future work. The goal is to add those systems on top of the deterministic session/party/content contracts rather than replace them.
