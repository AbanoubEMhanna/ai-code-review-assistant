import { Readable } from "node:stream";
import { describe, it, expect } from "vitest";
import { readStdin } from "./stdin.js";

function makeStream(content: string): Readable {
  return Readable.from([Buffer.from(content)]);
}

function makeTtyStream(): NodeJS.ReadStream {
  const s = new Readable({ read() {} }) as unknown as NodeJS.ReadStream;
  Object.defineProperty(s, "isTTY", { value: true, configurable: true });
  return s;
}

describe("readStdin", () => {
  it("throws when stdin is a TTY", async () => {
    await expect(readStdin(makeTtyStream())).rejects.toThrow("No input detected");
  });

  it("reads content from a non-TTY stream", async () => {
    const result = await readStdin(makeStream("diff --git a/foo.ts b/foo.ts\n+added line\n"));
    expect(result).toBe("diff --git a/foo.ts b/foo.ts\n+added line\n");
  });

  it("concatenates multi-chunk content", async () => {
    const s = new Readable({ read() {} });
    const promise = readStdin(s);
    s.push("chunk1\n");
    s.push("chunk2\n");
    s.push(null);
    expect(await promise).toBe("chunk1\nchunk2\n");
  });

  it("resolves with empty string for an empty stream", async () => {
    const s = new Readable({ read() {} });
    const promise = readStdin(s);
    s.push(null);
    expect(await promise).toBe("");
  });

  it("rejects when the stream emits an error", async () => {
    const s = new Readable({ read() {} });
    const promise = readStdin(s);
    s.destroy(new Error("pipe broken"));
    await expect(promise).rejects.toThrow("pipe broken");
  });
});
