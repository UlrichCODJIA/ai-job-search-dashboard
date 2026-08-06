import { describe, expect, test } from "bun:test";
import { parsePermissionMode } from "../src/routes/runs.js";

describe("parsePermissionMode", () => {
  test("undefined passes through as undefined (no mode requested)", () => {
    expect(parsePermissionMode(undefined)).toBeUndefined();
  });

  test("'default' and 'acceptEdits' are both accepted", () => {
    expect(parsePermissionMode("default")).toBe("default");
    expect(parsePermissionMode("acceptEdits")).toBe("acceptEdits");
  });

  test("plan/auto/bypassPermissions are all rejected even though the SDK supports them", () => {
    expect(() => parsePermissionMode("plan")).toThrow(/permissionMode must be one of/);
    expect(() => parsePermissionMode("auto")).toThrow(/permissionMode must be one of/);
    expect(() => parsePermissionMode("bypassPermissions")).toThrow(
      /permissionMode must be one of/,
    );
  });

  test("an arbitrary garbage string is rejected, not silently passed through", () => {
    expect(() => parsePermissionMode("yolo")).toThrow(/permissionMode must be one of/);
  });
});
