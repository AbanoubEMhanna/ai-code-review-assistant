import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./client.js";

const noDelay = () => Promise.resolve();

describe("withRetry", () => {
  it("returns result immediately when fn succeeds on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await withRetry(fn, 3, noDelay)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries after failure and succeeds on second attempt", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("transient")).mockResolvedValue("ok");
    expect(await withRetry(fn, 3, noDelay)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries up to the specified count then throws", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent"));
    await expect(withRetry(fn, 2, noDelay)).rejects.toThrow("persistent");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("with retries=0 throws immediately without retrying", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(withRetry(fn, 0, noDelay)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses exponential backoff delays between attempts", async () => {
    const delays: number[] = [];
    const trackDelay = (ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("e1"))
      .mockRejectedValueOnce(new Error("e2"))
      .mockResolvedValue("done");

    await withRetry(fn, 3, trackDelay);

    expect(delays).toEqual([1000, 2000]); // 1000*2^0, 1000*2^1
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("succeeds on the last allowed retry", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("e1"))
      .mockRejectedValueOnce(new Error("e2"))
      .mockResolvedValue("last chance");
    expect(await withRetry(fn, 2, noDelay)).toBe("last chance");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("preserves the error type of the final failure", async () => {
    class CustomError extends Error {}
    const fn = vi.fn().mockRejectedValue(new CustomError("typed"));
    await expect(withRetry(fn, 1, noDelay)).rejects.toBeInstanceOf(CustomError);
  });

  it("delay is not called when fn succeeds on first attempt", async () => {
    const trackDelay = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockResolvedValue("fast");
    await withRetry(fn, 3, trackDelay);
    expect(trackDelay).not.toHaveBeenCalled();
  });
});
