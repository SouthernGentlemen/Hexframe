import { describe, expect, it } from "vitest";
import { InputBit } from "../../src/combat/types";
import { InputPlayback, InputRecorder } from "../../src/input/recording/recorder";

describe("interaction recording", () => {
  it("round-trips Interact through deterministic input capture and replay", () => {
    const recorder = new InputRecorder();
    recorder.start(12);
    recorder.record(12, [InputBit.Interact, 0]);
    recorder.record(13, [InputBit.Right | InputBit.Interact, 0]);
    const playback = new InputPlayback(recorder.stop(), false);
    expect(playback.at(12, 0)).toBe(InputBit.Interact);
    expect(playback.at(13, 0)).toBe(InputBit.Right | InputBit.Interact);
  });
});
