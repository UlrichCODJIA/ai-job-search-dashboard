import { describe, expect, test } from "bun:test";
import { RootNotConfiguredError } from "../src/lib/paths.js";
import { handleServerError } from "../src/lib/serverError.js";

describe("handleServerError", () => {
  test("maps RootNotConfiguredError to a 503 with its own message", async () => {
    const res = handleServerError(new RootNotConfiguredError());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("isn't configured yet");
  });

  test("maps any other error to a generic 500", async () => {
    const res = handleServerError(new Error("boom"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("internal server error");
  });

  test("handles a non-Error thrown value the same way", async () => {
    const res = handleServerError("just a string");
    expect(res.status).toBe(500);
  });
});
