# Module contracts — Hexframe 0.1

`src/combat/types.ts` and `src/combat/constants.ts` are **authoritative**. Everything
below is written against them. If an implementation needs a shape those two files do not
have, that is a contract change: say so rather than adding a private variant.

Rules that hold everywhere:

1. **Integers only** below `src/combat`, `src/input` and `src/rollback`. No `Math.random`,
   no `Date.now`, no `performance.now`, no floats, no `/` that can produce a fraction —
   use `Math.trunc(a / b)` or a shift, and say why in a comment when it rounds.
2. **`import type`** for type-only imports (`verbatimModuleSyntax` is on).
3. The simulation may not import from `src/renderer`, `src/lab`, `src/client` or
   `src/worker`. The dependency arrow runs one way: content → combat → input/rollback →
   renderer → lab → client.
4. Anything reachable from the Worker bundle may not touch `document`, `window` or SVG.

---

## src/combat

### `collision/aabb.ts`
```ts
export function overlaps(a: Aabb, b: Aabb): boolean          // touching edges do NOT overlap
export function intersection(a: Aabb, b: Aabb): Aabb | null
export function boxToWorld(box: Box, originX: number, originY: number, facing: Facing): Aabb
export function centerOf(a: Aabb): { x: number; y: number }  // integer, truncated
```
`boxToWorld` is the single place mirroring happens: for `facing === 1` the world span is
`[originX + box.x, originX + box.x + box.w]`; for `facing === -1` it is
`[originX - box.x - box.w, originX - box.x]`. `y` never mirrors.

### `collision/boxes.ts`
```ts
export function activeMoveOf(f: FighterState, c: CharacterDef): MoveDef | null
export function pushboxOf(f: FighterState, c: CharacterDef): Aabb
export function hurtboxesOf(f: FighterState, c: CharacterDef): Aabb[]
export function activeHitboxesOf(f: FighterState, c: CharacterDef): { spec: HitboxSpec; aabb: Aabb }[]
export function isInvulnerable(f: FighterState, c: CharacterDef, kind: InvulKindValue): boolean
export function debugBoxes(state: SimState, chars: readonly CharacterDef[]): DebugBoxes
```
Stance selects the default set: `StateId.Crouch`, `HitstunCrouch` and `BlockstunCrouch`
use the crouching boxes; `airborne === 1` uses the air boxes; everything else standing.
A move's `hurtboxWindows` entry covering `moveFrame` **replaces** the default set.
`activeHitboxesOf` returns nothing while `hitstop > 0` is irrelevant — hitstop freezes
`moveFrame`, so the same hitbox stays active and the `hitFlags` gate stops a re-hit.

### `collision/pushbox.ts`
```ts
export function resolvePushboxes(state: SimState, chars: readonly CharacterDef[]): void
export function clampToStage(f: FighterState, c: CharacterDef): void
```
Separate overlapping pushboxes by moving each fighter half the overlap, the one with the
smaller `x` moving in `-x`. Ties (equal `x`) split by player index so the result never
depends on iteration accidents. Then clamp both to `±STAGE_HALF_WIDTH`; if clamping
re-introduces an overlap, push the *other* fighter instead — a cornered fighter is not
pushed through the wall.

### `state/machine.ts`
```ts
export function isGrounded(f: FighterState): boolean
export function isActionable(f: FighterState): boolean        // Idle | WalkForward | WalkBackward | Crouch
export function isCrouching(f: FighterState): boolean         // Crouch | HitstunCrouch | BlockstunCrouch
export function isInStun(f: FighterState): boolean
export function enterState(f: FighterState, s: StateIdValue): StateIdValue | null  // returns previous state when it changed, else null
export function hitstunStateFor(f: FighterState): StateIdValue
export function blockstunStateFor(f: FighterState): StateIdValue
export function tickTimers(f: FighterState): void             // hitstop first; nothing else ticks while it is non-zero
```

### `movement/physics.ts`
```ts
export function applyMovement(f: FighterState, c: CharacterDef): void
export function applyGroundMotion(f: FighterState, c: CharacterDef, input: InputFrame): void
```
`applyGroundMotion` sets walking velocity from the *facing-relative* direction while the
fighter is actionable. `applyMovement` integrates: `x += vx`, `y += vy`, then gravity
`vy -= gravity` while airborne, then ground clamp (`y <= GROUND_Y` ⇒ `y = GROUND_Y`,
`vy = 0`, `airborne = 0`, enter `Landing` for `landingFrames`), then ground friction
decays a residual `vx` toward zero by `groundFriction` per frame while not walking.

### `commands/resolve.ts`
```ts
export function moveOf(c: CharacterDef, moveId: number): MoveDef | null
export function canStartMove(f: FighterState, c: CharacterDef, m: MoveDef): boolean
export function startMove(f: FighterState, c: CharacterDef, m: MoveDef): void  // sets state, moveId, moveFrame=0, hitFlags=0
export function advanceMove(f: FighterState, c: CharacterDef): void            // moveFrame++, applies MovementKeys, ends the move at duration
export function cancelAllowed(f: FighterState, c: CharacterDef, intoMoveId: number): boolean
```
`canStartMove` is true when the fighter is actionable and the stance matches
(`requiresCrouch` ⇒ crouching, `airOk` ⇒ airborne allowed), **or** when
`cancelAllowed` says the current move may cancel into it.

### `hit-resolution/resolve.ts`
```ts
export function resolveContacts(
  state: SimState,
  chars: readonly CharacterDef[],
  inputs: readonly InputFrame[],
  report: FrameReport,
): void
export function isBlocking(
  defender: FighterState, defenderChar: CharacterDef,
  attacker: FighterState, input: InputFrame, level: HitLevelValue,
): boolean
```
Blocking, precisely: the defender blocks when they are grounded, not attacking, not
already in hitstun, holding the direction *away* from the attacker (`attacker.x > defender.x`
⇒ holding `Left`), and the stance suits the level — `Low` requires crouching, `Overhead`
requires standing, `Mid` accepts either. Holding back against a level the stance cannot
guard is a **hit**, not a block. Air blocking does not exist in 0.1.

On contact, in this order: set the `hitFlags` bit for `spec.id` on the attacker; apply
hitstop to both; on hit apply damage (clamped at 0), `hitstun`, the hitstun state, reset
`comboCount`+1, and pushback velocities; on block apply `blockstun`, the blockstun state
and block pushback. Push both fighters' `vx` along the **attacker's** facing. Append one
`ContactEvent` to `report.contacts`.

### `simulation/rng.ts`
```ts
export function nextRandom(state: SimState): number    // xorshift32, advances state.rng, returns a non-negative int32
export function randomRange(state: SimState, lo: number, hi: number): number  // inclusive
```

### `simulation/simulation.ts`
```ts
export class Simulation {
  readonly config: SimConfig
  state: SimState
  constructor(config: SimConfig)
  static initialState(config: SimConfig): SimState
  step(inputs: readonly InputFrame[]): FrameReport
  getState(): SimState                 // live reference, not a copy
  setState(next: SimState): void       // replaces wholesale; used by rollback and load-state
  characters(): readonly CharacterDef[]
}
```
`step` executes exactly the frame loop of the specification, in this order, and each
numbered step is a comment in the source:

1. write both inputs into `state.inputHistory`
2. resolve commands (`src/input/parser/command-parser.ts`) → possibly `startMove`
3. update fighter states and tick timers
4. apply movement
5. resolve facing — only for a grounded, actionable fighter, toward the opponent
6. pushboxes (`resolvePushboxes`) and stage clamp
7–10. hurtboxes, hitboxes, intersection, `resolveContacts`
11–13. hitstop, stun and health were applied by step 10; decrement here
14. entities (none in 0.1; the loop exists and iterates `state.entities`)
15–17. `state.frame++`, return the `FrameReport`

A fighter with `hitstop > 0` skips steps 2, 4 and the `moveFrame` advance of step 3. It
still decrements its own hitstop.

### `index.ts` (already written — do not change its export list)

---

## src/input

### `buffer/history.ts` — reads and writes `SimState.inputHistory`
```ts
export function writeInput(state: SimState, player: number, frame: number, input: InputFrame): void
export function readInput(state: SimState, player: number, frame: number): InputFrame
export function pressedOn(state: SimState, player: number, frame: number, bits: number): boolean  // released→pressed edge
export function heldOn(state: SimState, player: number, frame: number, bits: number): boolean
```
`readInput` for a frame older than the ring, or in the future, returns `0`.

### `parser/numpad.ts`
```ts
export function numpadOf(input: InputFrame, facing: Facing): number   // 1..9, 5 = neutral
export function isForward(input: InputFrame, facing: Facing): boolean
export function isBackward(input: InputFrame, facing: Facing): boolean
```
Opposing directions cancel to neutral on that axis (`Left|Right` ⇒ neither).

### `parser/command-parser.ts`
```ts
export function resolveCommand(state: SimState, player: number, c: CharacterDef, f: FighterState): number
export function motionSatisfied(state: SimState, player: number, f: FighterState, motion: number[], window: number, frame: number): boolean
```
`resolveCommand` returns a move id or `NO_MOVE`. It considers commands in descending
`priority`, and for each looks back up to `INPUT_BUFFER_FRAMES` for a press edge of any of
`buttons` at a frame **strictly after** `f.bufferConsumedFrame`. When one is found and the
motion and stance requirements hold, it returns that move id; the caller sets
`bufferConsumedFrame` to that press frame. Pure: it must not mutate anything.

### `buffer/input-buffer.ts` — client-side collection, not simulation state
```ts
export class InputBuffer {
  constructor(capacity?: number)
  push(frame: number, input: InputFrame): void
  at(frame: number): InputFrame          // 0 when unknown
  has(frame: number): boolean
  newestFrame(): number
  clear(): void
}
```

### `controller/keymap.ts`, `controller/keyboard.ts`, `controller/gamepad.ts` — browser only
```ts
export interface KeyMap { [code: string]: number }              // KeyboardEvent.code → InputBit
export interface ActionKeyMap { [code: string]: 0 | 1 | 2 | 3 } // physical key → diamond position
export const DEFAULT_KEYMAP_P1: KeyMap                          // WASD movement
export const DEFAULT_KEYMAP_P2: KeyMap                          // IJKL movement
export const DEFAULT_ACTION_KEYMAP: ActionKeyMap                // arrows → Y/X/B/A positions
export class KeyboardController {
  constructor(target: EventTarget, map: KeyMap, actionMap?: ActionKeyMap)
  sample(): InputFrame
  dispose(): void
}
export class GamepadController {
  constructor(index?: number, source?: GamepadSource)
  sample(): InputFrame
  sampleUi(): GamepadUiState
  get connected(): boolean
}
```
The four action positions repeat across four banks: unmodified, Shift/LT, Space/RT and
Shift+Space/LT+RT. This creates `Action1` through `Action16`; `actionBit(slot)` is the
only supported way to derive an action bit from a zero-based slot. A standard gamepad's
left stick or D-pad drives movement, and Y/X/B/A is the same spatial diamond as
up/left/right/down arrows. `sampleUi` exposes edge-detected menu controls to the lab:
D-pad navigation, A confirm, B back, View menu, Start pause and LB/RB tabs.

Keyboard controllers never call `preventDefault` on keys outside their maps and leave
native form controls alone so the complete lab remains keyboard navigable.

### `recording/recorder.ts`
```ts
export interface RecordedInputs { version: number; startFrame: number; frames: number[][] }  // [frame][player]
export class InputRecorder {
  start(frame: number): void
  record(frame: number, inputs: readonly InputFrame[]): void
  stop(): RecordedInputs
  get recording(): boolean
}
export class InputPlayback {
  constructor(data: RecordedInputs, loop: boolean)
  at(frame: number, player: number): InputFrame | null
  get length(): number
}
```

---

## src/rollback

### `hashing/fnv.ts`
```ts
export function fnv1a32(bytes: Uint8Array): number      // returns an unsigned 32-bit int
export function hashState(state: SimState): number
export function hashToHex(hash: number): string         // 8 lowercase hex digits
```
`hashState` hashes `serializeState(state)` — one definition of state, one hash.

### `snapshots/snapshot.ts`
```ts
export function serializeState(state: SimState): Uint8Array
export function deserializeState(bytes: Uint8Array): SimState
export function cloneState(state: SimState): SimState
```
Little-endian via `DataView` with an explicit `true`, never the platform default. Field
order is exactly declaration order in `types.ts`. Leads with `SNAPSHOT_VERSION`; a reader
that sees another version throws. `cloneState` must be a true deep copy and must not go
through `JSON.parse(JSON.stringify(...))`.

### `snapshots/ring.ts`
```ts
export class SnapshotRing {
  constructor(capacity: number)
  save(frame: number, state: SimState): void      // stores a serialised copy
  has(frame: number): boolean
  load(frame: number): SimState | null            // a fresh deserialised state each call
  oldestFrame(): number                            // -1 when empty
  newestFrame(): number                            // -1 when empty
  clear(): void
}
```

### `replay/rollback-session.ts`
```ts
export interface RollbackOptions { localPlayer: number; inputDelay: number; maxRollback: number }
export interface RollbackMetrics {
  currentRollback: number; maxRollbackSeen: number; predictedFrames: number;
  correctedFrames: number; rollbacks: number; desyncs: number; confirmedFrame: number;
}
export class RollbackSession {
  constructor(sim: Simulation, opts: RollbackOptions)
  readonly metrics: RollbackMetrics
  addLocalInput(input: InputFrame): number         // returns the frame it will apply to
  addRemoteInput(frame: number, input: InputFrame): void
  advance(): FrameReport
  currentFrame(): number
  hashAt(frame: number): number | null
  confirmedHash(frame: number, hash: number): boolean   // false ⇒ desync; increments metrics.desyncs
}
```
Prediction repeats the last known remote input. `addRemoteInput` for a frame already
simulated with a different prediction rewinds to that frame, restores the snapshot,
re-simulates to the present with the corrected inputs, and adds the number of
re-simulated frames to `correctedFrames`. Rolling back further than `maxRollback` is an
error, not a silent clamp.

---

## src/content

### `raw-types.ts` — the JSON shapes, authored in **world pixels and frames**
Mirror of the runtime types with `px`-valued numbers. `RawCharacter`, `RawMove`,
`RawHitbox`, `RawBox`, `RawCommand`, `RawRig`, `RawAnimation`.

### `validate.ts`
```ts
export class ContentError extends Error { constructor(path: string, message: string) }
export function validateCharacter(raw: unknown): RawCharacter    // throws ContentError with a JSON-pointer-ish path
export function validateMove(raw: unknown): RawMove
export function validateRig(raw: unknown): RawRig
export function validateAnimation(raw: unknown): RawAnimation
```
Hand-written, no dependency — this runs in the browser. `ajv` validates the same files
against `schemas/*.schema.json` in `tests/content`, so the schemas and this validator are
checked against each other rather than either being taken on trust.

### `loader.ts`
```ts
export function loadCharacter(raw: RawCharacter, moves: RawMove[]): CharacterDef
export function scaleBox(b: RawBox): Box
```
This is the **only** place `px()` is applied. A move's `duration` must equal
`startup + active + recovery`, and every hitbox window must fall inside the move —
`loadCharacter` throws `ContentError` if not.

### `test-fighter.ts`
```ts
export const TEST_FIGHTER: CharacterDef
export const MoveId: { readonly StandingLight: number; ... readonly PrismBurst: number }
export const DEFAULT_MOVE_LOADOUT: number[]                      // move ids 1..16
export function commandsForLoadout(c: CharacterDef, loadout: readonly number[]): CommandDef[]
export function testFighterWithLoadout(loadout: readonly number[]): CharacterDef
export function testFighterSimConfig(seed?: number): SimConfig
```
The test fighter exposes 24 tagged moves with distinct animation names. A loadout maps
the first 16 valid move ids to `Action1` through `Action16`; assignments are lab/client
configuration and therefore never enter deterministic simulation state.

---

## src/renderer  (browser only; may never influence simulation)

```ts
// svg/stage.ts
export function createStage(mount: HTMLElement): StageHandles   // { svg, world, layers: {…} }
export function worldToScreen(x: number, y: number): { x: number; y: number }

// character/rig.ts
export function buildFighterNode(model: string, rig: RawRig): FighterNode
export function applyPose(node: FighterNode, pose: Record<string, { rotation?: number; x?: number; y?: number }>): void

// animation/animator.ts
export function sampleAnimation(anim: RawAnimation, frame: number): Record<string, { rotation?: number; x?: number; y?: number }>
export function animationForState(f: FighterState, c: CharacterDef): string

// svg/debug-overlay.ts
export interface DebugToggles { hitboxes: boolean; hurtboxes: boolean; pushboxes: boolean; origins: boolean; skeleton: boolean; boneNames: boolean; velocity: boolean }
export function drawDebug(layer: SVGGElement, boxes: DebugBoxes, state: SimState, toggles: DebugToggles): void

// svg/renderer.ts
export class Renderer {
  constructor(mount: HTMLElement, chars: readonly CharacterDef[], assets: RendererAssets)
  render(state: SimState, report: FrameReport | null, toggles: DebugToggles): void
  dispose(): void
}
```
Visual interpolation between animation keyframes is allowed and expected. It must never
be read back into anything under `src/combat`.

---

## src/lab

```ts
// timeline/timeline.ts
export type LabSpeed = 25 | 50 | 100 | 200
export class Timeline {
  constructor(sim: Simulation, ringCapacity: number)
  paused: boolean
  speed: LabSpeed
  stepFrames(n: number): void        // n < 0 restores a snapshot; it never runs the simulation backwards
  tick(realFramesElapsed: number): FrameReport[]
  saveState(slot: number): void
  loadState(slot: number): boolean
  reset(): void
}

// dummy/dummy.ts
export const DummyMode = { Stand:0, Crouch:1, Jump:2, BlockNone:3, BlockAll:4, BlockAfterFirstHit:5, Record:6, Playback:7, Counterattack:8, Reversal:9 } as const
export class DummyController {
  mode: number
  inputFor(state: SimState, player: number, lastReport: FrameReport | null): InputFrame
  reset(): void
}

// debugger/panel.ts
export class DebugPanel {
  constructor(mount: HTMLElement)
  update(state: SimState, chars: readonly CharacterDef[], report: FrameReport | null, hash: number): void
}

// app.ts
export function startLab(mount: HTMLElement): () => void      // returns a teardown
```
The dummy is an **input source**. It never writes fighter state, which is what keeps the
training modes out of the snapshot and out of the hash.

---

## src/worker

```ts
// env.ts
export interface Env {
  ASSETS: Fetcher
  ENVIRONMENT: string
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  ADMIN_SESSION_SECRET?: string
}

// auth/session.ts
export const SESSION_COOKIE = "sm_session"
export async function createSessionCookie(env: Env, username: string, ttlSeconds: number): Promise<string>
export async function verifySessionCookie(env: Env, header: string | null): Promise<{ username: string; expires: number } | null>
export function clearSessionCookie(): string
export function timingSafeEqual(a: string, b: string): boolean

// auth/credentials.ts
export function credentialsConfigured(env: Env): boolean
export function checkCredentials(env: Env, username: string, password: string): boolean

// routes/login.ts
export function loginPage(error: string | null, next: string): Response
export async function handleLogin(request: Request, env: Env): Promise<Response>
export function handleLogout(): Response

// routes/lab.ts
export async function handleLab(request: Request, env: Env, url: URL): Promise<Response>

// routes/api-lab.ts
export async function handleLabApi(request: Request, env: Env, url: URL): Promise<Response>
```
The session cookie is `HttpOnly; Secure; SameSite=Strict; Path=/`. It carries
`username|expiry|HMAC-SHA256(username|expiry)` under `ADMIN_SESSION_SECRET`, base64url,
verified with a constant-time comparison. `Secure` is omitted **only** when the request
origin is `http://localhost`, so `wrangler dev` works without weakening production.

If any of the three credentials is missing, every protected route answers `503` with a
message naming which binding is absent. It never falls open, and it never falls back to a
default password.

---

## tests

| directory | proves |
|---|---|
| `tests/collisions` | AABB overlap and mirroring; pushbox separation; corner behaviour |
| `tests/simulation` | walking, crouching, jumping, landing, stage clamp, facing |
| `tests/moves` | standing light: startup, active, recovery, whiff, hit, block, damage, hitstop, hitstun, blockstun, one hit per move |
| `tests/input` | numpad conversion, press edges, the buffer window, one move per press, standard gamepad movement and all four trigger-selected action banks |
| `tests/determinism` | identical inputs ⇒ identical hash; snapshot round-trip is bit-exact; no `Math.random`/`Date.now` anywhere under src/combat, src/input, src/rollback |
| `tests/rollback` | the specification's §6 scenario; misprediction correction; hash equality after re-simulation |
| `tests/content` | every JSON under `characters/` validates against `schemas/` with ajv, the hand-written validator agrees with ajv, and the 24-move tagged catalog/loadout/animation contract is complete |
