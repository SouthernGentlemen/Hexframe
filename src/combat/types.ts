/**
 * The shape of everything the simulation stores, reads or emits.
 *
 * This file is a contract. Every other module in `src/combat`, `src/input`,
 * `src/rollback`, `src/renderer` and `src/lab` is written against it, so changing a
 * field here changes the snapshot layout, the determinism hash and the wire format at
 * once. Add fields at the end of a structure and bump `SNAPSHOT_VERSION`.
 *
 * Two separations are load-bearing and are stated here rather than left to discipline:
 *
 *  - **Visual data is not combat data.** Nothing in this file describes a bone, a
 *    rotation or an interpolation. `MoveDef.animation` is a name the renderer looks up;
 *    the simulation never reads the animation it points at.
 *  - **Simulation state is not simulation output.** `SimState` is hashed, snapshotted
 *    and rolled back. `FrameReport` is what happened during one step, for the renderer
 *    and the lab to look at, and is never part of the hash.
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * One frame of input for one player, as a bitmask of `InputBit` values.
 *
 * Directions are **absolute** (left and right, not forward and back). The command
 * parser converts them to facing-relative numpad notation. Absolute is what gets
 * networked, recorded and hashed, because it is what the player physically did and it
 * stays meaningful when a rollback changes which way the fighter was facing.
 */
export type InputFrame = number;

export const InputBit = {
  Up: 1 << 0,
  Down: 1 << 1,
  Left: 1 << 2,
  Right: 1 << 3,
  Light: 1 << 4,
  Medium: 1 << 5,
  Heavy: 1 << 6,
  Throw: 1 << 7,
} as const;

/** Every bit the engine defines. Anything outside this mask is dropped on the way in. */
export const INPUT_MASK = 0xff;

/** All attack buttons, for "is any attack pressed" tests. */
export const ATTACK_BUTTONS = InputBit.Light | InputBit.Medium | InputBit.Heavy | InputBit.Throw;

/** All directions. */
export const DIRECTION_BITS = InputBit.Up | InputBit.Down | InputBit.Left | InputBit.Right;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Which way a fighter faces. `1` is toward increasing x, `-1` toward decreasing x. */
export type Facing = 1 | -1;

/**
 * A box in **fighter-local space**, in sim units.
 *
 * `x` runs *forward* — in the direction the fighter faces — from the fighter's ground
 * origin, and `y` runs up from the ground. This is why a move is authored once and
 * never as a left and a right variant: mirroring is `facing === 1 ? x : -x - w`.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A resolved, world-space, axis-aligned box. `x0 < x1` and `y0 < y1` always hold. */
export interface Aabb {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** How an attack must be guarded. */
export const HitLevel = {
  /** Overhead: must be blocked standing. */
  Overhead: 0,
  /** Mid: blocked standing or crouching. */
  Mid: 1,
  /** Low: must be blocked crouching. */
  Low: 2,
} as const;
export type HitLevelValue = (typeof HitLevel)[keyof typeof HitLevel];

// ---------------------------------------------------------------------------
// Move data (runtime form — sim units, already scaled by the content loader)
// ---------------------------------------------------------------------------

/**
 * One attack box and everything that happens when it connects.
 *
 * Frame numbers are 0-based indices into the move, inclusive at both ends, and are
 * compared against `FighterState.moveFrame`.
 */
export interface HitboxSpec {
  /** Unique within its move. Indexes the once-per-move gate in `FighterState.hitFlags`. */
  id: number;
  box: Box;
  startFrame: number;
  endFrame: number;
  level: HitLevelValue;
  damage: number;
  hitstun: number;
  blockstun: number;
  hitstopAttacker: number;
  hitstopDefender: number;
  /** Velocity applied on contact, in sim units per frame, along the attacker's facing. */
  pushbackHitAttacker: number;
  pushbackHitDefender: number;
  pushbackBlockAttacker: number;
  pushbackBlockDefender: number;
}

/** Hurtboxes that replace the fighter's default ones for part of a move. */
export interface HurtboxWindow {
  startFrame: number;
  endFrame: number;
  boxes: Box[];
}

/** What a fighter cannot be touched by during part of a move. */
export const InvulKind = { Full: 0, Strike: 1, Throw: 2 } as const;
export type InvulKindValue = (typeof InvulKind)[keyof typeof InvulKind];

export interface InvulWindow {
  startFrame: number;
  endFrame: number;
  kind: InvulKindValue;
}

/**
 * A velocity change scheduled at a move frame. `vx` is along the fighter's facing and is
 * mirrored automatically; `vy` is world-up. Applied as a set, not an add.
 */
export interface MovementKey {
  frame: number;
  vx: number;
  vy: number;
}

/** A window in which this move may be cancelled into another. */
export interface CancelWindow {
  startFrame: number;
  endFrame: number;
  /** Move ids this may cancel into. */
  into: number[];
  /** When true the cancel is only available if the move has already connected. */
  onHitOnly: boolean;
}

/** A move: what the game *does*. Its `animation` is only a name the renderer resolves. */
export interface MoveDef {
  id: number;
  key: string;
  animation: string;
  duration: number;
  startup: number;
  active: number;
  recovery: number;
  /** True for crouching normals: the move only comes out, and stays, while crouching. */
  requiresCrouch: boolean;
  /** True for air normals. */
  airOk: boolean;
  hitboxes: HitboxSpec[];
  hurtboxWindows: HurtboxWindow[];
  invulWindows: InvulWindow[];
  movement: MovementKey[];
  cancelWindows: CancelWindow[];
}

/** How a player asks for a move. Motions are facing-relative numpad digits. */
export interface CommandDef {
  moveId: number;
  /**
   * Button bits. The command is eligible on a frame where any of these buttons went
   * from released to pressed, within `INPUT_BUFFER_FRAMES` of that press.
   */
  buttons: number;
  /** Numpad sequence, e.g. `[2, 3, 6]` for a quarter-circle forward. Empty for normals. */
  motion: number[];
  /** How many frames the whole motion may take. Ignored when `motion` is empty. */
  motionWindow: number;
  requiresCrouch: boolean;
  requiresAir: boolean;
  /** Higher wins when several commands match on the same frame. */
  priority: number;
}

/** A fighter's complete combat definition, in sim units. */
export interface CharacterDef {
  id: string;
  name: string;
  health: number;
  walkForwardSpeed: number;
  walkBackwardSpeed: number;
  dashSpeed: number;
  dashDuration: number;
  jumpVelocityY: number;
  jumpVelocityXForward: number;
  jumpVelocityXBackward: number;
  jumpSquatFrames: number;
  landingFrames: number;
  gravity: number;
  /** Per-frame decay applied to residual horizontal velocity while grounded. */
  groundFriction: number;
  pushboxStand: Box;
  pushboxCrouch: Box;
  pushboxAir: Box;
  hurtboxesStand: Box[];
  hurtboxesCrouch: Box[];
  hurtboxesAir: Box[];
  moves: MoveDef[];
  commands: CommandDef[];
}

// ---------------------------------------------------------------------------
// Simulation state — hashed, snapshotted, rolled back
// ---------------------------------------------------------------------------

export const StateId = {
  Idle: 0,
  WalkForward: 1,
  WalkBackward: 2,
  Crouch: 3,
  JumpSquat: 4,
  Airborne: 5,
  Landing: 6,
  Attack: 7,
  HitstunStand: 8,
  HitstunCrouch: 9,
  HitstunAir: 10,
  BlockstunStand: 11,
  BlockstunCrouch: 12,
  Dash: 13,
  Knockdown: 14,
} as const;
export type StateIdValue = (typeof StateId)[keyof typeof StateId];

/**
 * One fighter, entirely as integers.
 *
 * Every field here is serialised, hashed and restored. Nothing derived from rendering,
 * from wall-clock time or from the browser may be added to it.
 */
export interface FighterState {
  /** Ground origin, sim units. `y` is height above the ground; `GROUND_Y` when standing. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Facing;
  state: StateIdValue;
  /** Frames spent in the current state, starting at 0 on the frame it was entered. */
  stateFrame: number;
  /** `NO_MOVE` when not attacking. */
  moveId: number;
  /** 0-based frame within the current move. Frozen while `hitstop > 0`. */
  moveFrame: number;
  /** Frames of hitstop left. While non-zero the fighter's move and physics are frozen. */
  hitstop: number;
  /** Frames of hitstun or blockstun left, depending on `state`. */
  stun: number;
  health: number;
  /** 1 when off the ground. Redundant with `y` by design: it survives moves that lift. */
  airborne: number;
  /** Bitmask of `HitboxSpec.id`s that have already connected during the current move. */
  hitFlags: number;
  /** Hits taken since the defender was last actionable. Drives combo display and scaling. */
  comboCount: number;
  /**
   * Absolute frame of the most recent button press that has already been turned into a
   * move. Without it the input buffer would fire the same press on every frame of its
   * window; with it, a press produces exactly one move however early it was made.
   */
  bufferConsumedFrame: number;
}

/** A deterministic spawned entity — projectiles from 0.2. Present so rollback covers it. */
export interface EntityState {
  kind: number;
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hitFlags: number;
}

/** The complete authoritative state of a match on one frame. */
export interface SimState {
  frame: number;
  /** Deterministic RNG word. Part of the state, so a rollback replays the same rolls. */
  rng: number;
  /** Always exactly `PLAYER_COUNT` entries, in player-index order. */
  fighters: FighterState[];
  entities: EntityState[];
  /** 1 once a fighter has reached zero health. The lab does not stop the clock. */
  roundOver: number;
  /**
   * The last `COMMAND_HISTORY_FRAMES` input frames per player, as a ring indexed by
   * `frame % COMMAND_HISTORY_FRAMES`, in player-index order.
   *
   * Command parsing happens *inside* `Simulation.step()` — step 2 of the frame loop —
   * so the history the parser reads is authoritative simulation state. Keeping it here
   * rather than in a client-side object is what makes a rollback re-derive the same
   * moves from the same presses instead of trusting the caller to replay a parser.
   */
  inputHistory: number[][];
}

// ---------------------------------------------------------------------------
// Simulation output — never hashed
// ---------------------------------------------------------------------------

export const ContactKind = { Hit: 0, Block: 1 } as const;
export type ContactKindValue = (typeof ContactKind)[keyof typeof ContactKind];

export interface ContactEvent {
  attacker: number;
  defender: number;
  moveId: number;
  hitboxId: number;
  kind: ContactKindValue;
  level: HitLevelValue;
  damage: number;
  /** Approximate world point of contact, for the renderer's effects. */
  x: number;
  y: number;
}

/** What one `step()` produced. Read by the renderer and the lab; never by the simulation. */
export interface FrameReport {
  frame: number;
  contacts: ContactEvent[];
  moveStarts: { player: number; moveId: number }[];
  /** A fighter's state changed this frame, for the lab's state log. */
  stateChanges: { player: number; from: StateIdValue; to: StateIdValue }[];
}

// ---------------------------------------------------------------------------
// Simulation configuration
// ---------------------------------------------------------------------------

export interface SimConfig {
  characters: [CharacterDef, CharacterDef];
  /** Starting ground origins in sim units. */
  startX: [number, number];
  /** Seed for the deterministic RNG. */
  seed: number;
}

/** World-space collision volumes for one frame, for the debug overlay and for tests. */
export interface DebugBoxes {
  pushboxes: Aabb[];
  hurtboxes: Aabb[][];
  hitboxes: Aabb[][];
  origins: { x: number; y: number }[];
}
