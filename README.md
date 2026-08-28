# Hexframe

A deterministic 2D combat laboratory built around authored fighting-game systems,
rollback infrastructure, exact frame inspection, reproducible captures, and an animated
move Codex.

**[Live](https://hexframe.wizardgang.ai)** · **[Architecture](docs/ARCHITECTURE.md)** ·
**[Releases](../../releases)** · **[Engineering record](docs/RECONSTRUCTION.md)**

## What it does

Hexframe runs a fixed 60 Hz, integer-only simulation in the browser. One frame of inputs
goes in, one frame of authoritative state comes out — no clock is read, no ambient
randomness is sampled, and nothing outside that state can change the outcome. Everything
else is downstream: rendering, tooling, deterministic AI, and the server boundary.

The default product surface is the authenticated developer laboratory. It exposes:

- **Frame transport** — pause, step ±1/±10, resume, reset, and auto-freeze on contact.
- **Authoritative state inspection** — exact frame state beside the rendered fight.
- **Combat geometry** — hitboxes, hurtboxes, pushboxes, origins, skeletons, and velocity.
- **Reproducible scenario capture** — exact per-frame inputs plus terminal state hashes for
  deterministic replay and regression fixtures.
- **Interaction history and frame timelines** — freeze a contact and inspect what the
  simulation decided on that frame.
- **Animated Move Codex** — `/codex/moves/:id/` runs the real deterministic move
  demonstration with Demo/Hit/Block modes, playback speeds, pause/step/scrub, frame
  timeline, search, and authored move detail.

Hexframe also contains Fight and Campaign configurations, including the Black Belfry
vertical slice and Bell Warden. Those systems remain implemented and testable, but they
are secondary evidence of what the combat architecture can support rather than the
project's default presentation.

## Interesting engineering

**Determinism is a property of the data, not a convention.** Every stored quantity is a
32-bit integer; positions are sim units at 1/100 pixel, converted from authored pixels once
in the loader. Two machines that disagree in the last bit of a double eventually disagree
about whether an attack hit.

**Command parsing happens inside the step.** If it ran in front of the simulation, a
rollback would depend on the caller faithfully re-running a parser the simulation cannot
see, and the first disagreement would surface frames later as an unexplained divergence.

**The random generator lives inside the snapshot.** A generator held at module scope
desynchronises the moment anything uses it, because restoring a snapshot would not restore
it.

**Rendering cannot influence the simulation.** `src/combat`, `src/rollback`, `src/input`
and `src/game` import nothing from `src/renderer`, `src/lab` or `src/client`.

**The training tools are the debugger.** Scenarios capture exact per-frame inputs and a
terminal state hash, so a bug report replays to the same bits.

**The Codex is executable documentation.** Its move previews reuse the same authored
fighter, deterministic simulation, renderer, and frame-report path as the laboratory
rather than maintaining a separate animation approximation.

## Run locally

```bash
npm ci
cp .env.example .env   # fill in the developer credentials you want locally
npm run dev
```

`/` and `/lab` enter the protected developer laboratory. `/codex/` and
`/codex/moves/:id/` are protected developer Codex routes. Player/campaign routes remain in
the application for direct testing but are not the default entry.

## Testing

```bash
npm test
npm run typecheck
npm run build
```

The suite covers deterministic replay and state hashing, snapshot round-trips, collision
and hit resolution, command parsing, content conformance against the published schemas,
AI determinism, worker route separation, authenticated developer surfaces, and
accessibility contracts for the interface.

## Release model

Releases are semantic versions, and a tag only exists if checking it out reproduces that
product state. Production deploys a release tag, never an arbitrary `main` commit, and the
running deployment states its own identity at
[`/version.json`](https://hexframe.wizardgang.ai/version.json).

See [docs/RELEASE-MANAGEMENT.md](docs/RELEASE-MANAGEMENT.md) and
[docs/CHANGE-MANAGEMENT.md](docs/CHANGE-MANAGEMENT.md).

## Engineering record

This public history was **reconstructed** from the original private development repository,
its deployed artifacts, and its tests. The reconstructed commit structure does not assert
that each public commit originally existed as an independent Git commit. Original source
commits and dates are kept in
[docs/history/CHANGE-MAP.csv](docs/history/CHANGE-MAP.csv), and the method — including what
was changed on purpose — is documented in [docs/RECONSTRUCTION.md](docs/RECONSTRUCTION.md).

Development, release, security and change-management controls here are designed to support
evidence aligned with ISO/IEC 27001:2022 and ISO/IEC 42001:2023. **No certification is
claimed**, and a Git repository does not by itself make a project compliant.

## Security

Reported privately through GitHub's advisory flow. See [SECURITY.md](SECURITY.md) and
[docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md).

## AI applicability

Hexframe contains **no machine learning**. Its "AI" is a deterministic rule system that
plays a party slot from authored loadouts and emits ordinary input frames. See
[docs/AI-APPLICABILITY.md](docs/AI-APPLICABILITY.md), which states what is verifiable and
how to verify it.

## License

MIT — see [LICENSE](LICENSE) and [docs/LICENSING.md](docs/LICENSING.md).
