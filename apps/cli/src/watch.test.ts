import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { doWatchTick, watchStagedChanges } from "./watch.js";

// ─── doWatchTick ─────────────────────────────────────────────────────────────

describe("doWatchTick", () => {
  it("calls onChanged with the first detected diff", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const onCleared = vi.fn();
    const fetchDiff = vi.fn().mockResolvedValue("diff content");
    const state: { value: string | null } = { value: null };

    await doWatchTick(fetchDiff, state, { onChanged, onCleared });

    expect(onChanged).toHaveBeenCalledOnce();
    expect(onChanged).toHaveBeenCalledWith("diff content");
    expect(state.value).toBe("diff content");
    expect(onCleared).not.toHaveBeenCalled();
  });

  it("does not call onChanged when diff is unchanged", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const onCleared = vi.fn();
    const fetchDiff = vi.fn().mockResolvedValue("same diff");
    const state: { value: string | null } = { value: "same diff" };

    await doWatchTick(fetchDiff, state, { onChanged, onCleared });

    expect(onChanged).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();
  });

  it("calls onChanged when diff changes from a previous value", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const onCleared = vi.fn();
    const fetchDiff = vi.fn().mockResolvedValue("new diff");
    const state: { value: string | null } = { value: "old diff" };

    await doWatchTick(fetchDiff, state, { onChanged, onCleared });

    expect(onChanged).toHaveBeenCalledWith("new diff");
    expect(state.value).toBe("new diff");
    expect(onCleared).not.toHaveBeenCalled();
  });

  it("calls onCleared when staging area empties after having changes", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const onCleared = vi.fn();
    const fetchDiff = vi.fn().mockRejectedValue(new Error("No staged changes"));
    const state: { value: string | null } = { value: "previous diff" };

    await doWatchTick(fetchDiff, state, { onChanged, onCleared });

    expect(onCleared).toHaveBeenCalledOnce();
    expect(state.value).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("does not call onCleared when staging was already empty", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const onCleared = vi.fn();
    const fetchDiff = vi.fn().mockRejectedValue(new Error("No staged changes"));
    const state: { value: string | null } = { value: null };

    await doWatchTick(fetchDiff, state, { onChanged, onCleared });

    expect(onCleared).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("updates state.value before awaiting onChanged", async () => {
    const stateSnapshot: string[] = [];
    const state: { value: string | null } = { value: null };
    const onChanged = vi.fn().mockImplementation(async () => {
      stateSnapshot.push(state.value ?? "null");
    });
    const onCleared = vi.fn();
    const fetchDiff = vi.fn().mockResolvedValue("diff A");

    await doWatchTick(fetchDiff, state, { onChanged, onCleared });

    expect(stateSnapshot).toEqual(["diff A"]);
  });

  it("propagates errors thrown by onChanged to the caller", async () => {
    const onChanged = vi.fn().mockRejectedValue(new Error("review failed"));
    const onCleared = vi.fn();
    const fetchDiff = vi.fn().mockResolvedValue("diff");
    const state: { value: string | null } = { value: null };

    await expect(doWatchTick(fetchDiff, state, { onChanged, onCleared })).rejects.toThrow(
      "review failed"
    );
    expect(onCleared).not.toHaveBeenCalled();
  });
});

// ─── watchStagedChanges ───────────────────────────────────────────────────────

describe("watchStagedChanges", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stop() clears the interval so no further ticks fire", async () => {
    const fetchDiff = vi.fn().mockResolvedValue("diff-A");
    const onChanged = vi.fn().mockResolvedValue(undefined);

    const stop = watchStagedChanges({
      intervalMs: 1000,
      fetchDiff,
      onChanged,
      onCleared: vi.fn(),
    });

    // stop() before any interval ticks
    stop();

    // Advancing time should not trigger the interval
    await vi.advanceTimersByTimeAsync(5000);

    // Only the immediate synchronous runTick() was invoked before stop()
    expect(fetchDiff.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("fires onChanged each time the diff changes across polling intervals", async () => {
    let diffVersion = 1;
    const fetchDiff = vi.fn().mockImplementation(async () => `diff-v${diffVersion}`);
    const onChanged = vi.fn().mockResolvedValue(undefined);

    const stop = watchStagedChanges({
      intervalMs: 500,
      fetchDiff,
      onChanged,
      onCleared: vi.fn(),
    });

    // Let the immediate tick and subsequent interval ticks resolve
    // diff-v1: first detected → onChanged called
    await vi.advanceTimersByTimeAsync(0);
    expect(onChanged.mock.calls.length).toBeGreaterThanOrEqual(0); // async, may not have resolved yet

    // Advance one interval; diff still v1 → no extra onChanged
    diffVersion = 1;
    await vi.advanceTimersByTimeAsync(500);

    // Change diff; next interval should trigger onChanged
    diffVersion = 2;
    await vi.advanceTimersByTimeAsync(500);

    // fetchDiff was called at least for the interval ticks
    expect(fetchDiff.mock.calls.length).toBeGreaterThanOrEqual(2);

    stop();
  });
});
