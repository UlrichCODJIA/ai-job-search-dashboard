import { describe, expect, test } from "bun:test";
import { isPermissionChannelBrokenError } from "../src/lib/claudeRunner.js";

describe("isPermissionChannelBrokenError", () => {
  test("matches the SDK's own error text", () => {
    expect(isPermissionChannelBrokenError("Tool permission request failed: AbortError: Stream closed")).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(isPermissionChannelBrokenError("stream CLOSED")).toBe(true);
  });

  test("does not match an unrelated tool error", () => {
    expect(isPermissionChannelBrokenError("Error: ENOENT: no such file or directory")).toBe(false);
  });

  test("does not match ordinary tool output that happens to mention streams", () => {
    expect(isPermissionChannelBrokenError("Streaming response written to stdout")).toBe(false);
  });
});
