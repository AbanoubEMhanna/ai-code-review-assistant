import { describe, expect, it } from "vitest";
import { validateHostUrl } from "./validate.js";

describe("validateHostUrl", () => {
  it("accepts a valid http URL", () => {
    expect(() => validateHostUrl("http://localhost:11434")).not.toThrow();
  });

  it("accepts a valid https URL", () => {
    expect(() => validateHostUrl("https://example.com:1234")).not.toThrow();
  });

  it("rejects a string that is not a URL", () => {
    expect(() => validateHostUrl("not-a-url")).toThrow(/Invalid --host URL/);
  });

  it("rejects an empty string", () => {
    expect(() => validateHostUrl("")).toThrow(/Invalid --host URL/);
  });

  it("rejects a non-http(s) protocol", () => {
    expect(() => validateHostUrl("ftp://localhost:11434")).toThrow(
      /protocol must be http or https/
    );
  });

  it("includes the offending value in the error message", () => {
    expect(() => validateHostUrl("banana")).toThrow(/"banana"/);
  });
});
