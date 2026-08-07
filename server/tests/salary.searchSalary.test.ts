import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { paths: realPaths, REPO_ROOT: realRepoRoot } = await import("../src/lib/paths.js");
const mockPaths = { ...realPaths };
let testDir: string;

interface FakeChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
}

function createFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

let lastChild: FakeChild | null = null;
let lastSpawnCall: { command: string; args: string[]; options: Record<string, unknown> } | null = null;
let spawnCallCount = 0;

mock.module("../src/lib/paths.js", () => ({
  REPO_ROOT: realRepoRoot,
  paths: mockPaths,
}));

mock.module("node:child_process", () => ({
  spawn: (command: string, args: string[], options: Record<string, unknown>) => {
    spawnCallCount++;
    lastSpawnCall = { command, args, options };
    lastChild = createFakeChild();
    return lastChild;
  },
}));

const { searchSalary } = await import("../src/lib/salary.js");

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), "salary-test-"));
  mockPaths.salaryData = path.join(testDir, "salary_data.json");
  mockPaths.salaryLookupScript = path.join(testDir, "salary_lookup.py");
  lastChild = null;
  lastSpawnCall = null;
  spawnCallCount = 0;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("searchSalary", () => {
  test("rejects and never spawns when salary_data.json doesn't exist", async () => {
    await expect(searchSalary("acme")).rejects.toThrow("salary_data.json not found");
    expect(spawnCallCount).toBe(0);
  });

  test("resolves with parsed JSON on a clean exit", async () => {
    writeFileSync(mockPaths.salaryData, "{}");
    const promise = searchSalary("acme");
    lastChild!.stdout.emit("data", Buffer.from(JSON.stringify([{ company: "Acme" }])));
    lastChild!.emit("close", 0);
    await expect(promise).resolves.toEqual([{ company: "Acme" }]);
  });

  test("rejects when exit code 0 but stdout isn't valid JSON", async () => {
    writeFileSync(mockPaths.salaryData, "{}");
    const promise = searchSalary("acme");
    lastChild!.stdout.emit("data", Buffer.from("not json"));
    lastChild!.emit("close", 0);
    await expect(promise).rejects.toThrow("salary_lookup.py returned non-JSON output");
  });

  test("resolves to an empty array on exit code 1 with no stderr (the 'no matches' convention)", async () => {
    writeFileSync(mockPaths.salaryData, "{}");
    const promise = searchSalary("nonexistent");
    lastChild!.emit("close", 1);
    await expect(promise).resolves.toEqual([]);
  });

  test("rejects with trimmed stderr on exit code 1 when stderr is present", async () => {
    writeFileSync(mockPaths.salaryData, "{}");
    const promise = searchSalary("acme");
    lastChild!.stderr.emit("data", Buffer.from("  Traceback: boom  \n"));
    lastChild!.emit("close", 1);
    await expect(promise).rejects.toThrow("Traceback: boom");
  });

  test("rejects with a fallback message on another non-zero exit code with no stderr", async () => {
    writeFileSync(mockPaths.salaryData, "{}");
    const promise = searchSalary("acme");
    lastChild!.emit("close", 2);
    await expect(promise).rejects.toThrow("salary_lookup.py exited with code 2");
  });

  test("rejects when the spawned process itself errors (e.g. python not found)", async () => {
    writeFileSync(mockPaths.salaryData, "{}");
    const promise = searchSalary("acme");
    lastChild!.emit("error", new Error("spawn python ENOENT"));
    await expect(promise).rejects.toThrow("spawn python ENOENT");
  });

  test("invokes the script with the query, --json, and cwd: REPO_ROOT", async () => {
    writeFileSync(mockPaths.salaryData, "{}");
    const promise = searchSalary("acme corp");
    lastChild!.emit("close", 1);
    await promise;
    expect(lastSpawnCall?.args).toEqual([mockPaths.salaryLookupScript, "acme corp", "--json"]);
    expect(lastSpawnCall?.options).toMatchObject({ cwd: realRepoRoot });
  });
});
