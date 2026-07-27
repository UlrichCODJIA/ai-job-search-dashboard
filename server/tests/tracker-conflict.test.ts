import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { paths: realPaths, REPO_ROOT: realRepoRoot } = await import("../src/lib/paths.js");
const mockPaths = { ...realPaths };
let testDir: string;

mock.module("../src/lib/paths.js", () => ({
  REPO_ROOT: realRepoRoot,
  paths: mockPaths,
}));

const { updateTrackerRow, TrackerRowConflictError, bucketForStatus } = await import("../src/lib/tracker.js");

const HEADER =
  "date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source";

function trackerPath(): string {
  return path.join(testDir, "job_search_tracker.csv");
}

function csvRow(status: string, notes: string): string {
  return `2026-01-01,Acme Corp,Software,Engineer,full_time,referral,${status},Jane,high,${notes},cv.tex,cover.tex,https://example.com`;
}

function idFor(index: number): string {
  return Buffer.from(`2026-01-01|Acme Corp|Engineer|${index}`, "utf-8").toString("base64url");
}

describe("updateTrackerRow -- concurrent-edit conflict detection", () => {
  beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), "tracker-test-"));
    mockPaths.tracker = trackerPath();
    const csv = [HEADER, csvRow("applied", "first contact"), csvRow("interview", "second row, unrelated")].join(
      "\n",
    );
    writeFileSync(trackerPath(), csv + "\n", "utf-8");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test("matching expected values: the save succeeds and writes exactly the patched fields", async () => {
    const updated = await updateTrackerRow(
      idFor(0),
      { status: "applied", notes: "first contact" },
      { status: "interview", notes: "moved to interview" },
    );
    expect(updated?.status).toBe("interview");
    expect(updated?.notes).toBe("moved to interview");
    expect(updated?.bucket).toBe(bucketForStatus("interview"));

    const written = readFileSync(trackerPath(), "utf-8");
    expect(written).toContain("interview,Jane,high,moved to interview");
    expect(written).toContain("second row, unrelated");
  });

  test("editing only notes is unaffected by status having changed concurrently elsewhere", async () => {
    const concurrentlyChanged = [HEADER, csvRow("offer", "first contact"), csvRow("interview", "second row, unrelated")].join(
      "\n",
    );
    writeFileSync(trackerPath(), concurrentlyChanged + "\n", "utf-8");
    const updated = await updateTrackerRow(idFor(0), { notes: "first contact" }, { notes: "adding detail" });
    expect(updated?.notes).toBe("adding detail");
    expect(updated?.status).toBe("offer");

    const written = readFileSync(trackerPath(), "utf-8");
    expect(written).toContain("offer,Jane,high,adding detail");
  });

  test("editing status when it changed concurrently is rejected, not silently overwritten", async () => {
    const concurrentlyChanged = [HEADER, csvRow("offer", "first contact"), csvRow("interview", "second row, unrelated")].join(
      "\n",
    );
    writeFileSync(trackerPath(), concurrentlyChanged + "\n", "utf-8");

    const attempt = updateTrackerRow(idFor(0), { status: "applied" }, { status: "interview" });
    await expect(attempt).rejects.toThrow(TrackerRowConflictError);

    const stillOnDisk = readFileSync(trackerPath(), "utf-8");
    expect(stillOnDisk).toContain("offer,Jane,high,first contact");
    expect(stillOnDisk).not.toContain("interview,Jane,high,first contact");
  });

  test("the rejected save's error names the field, expected value, and actual value", async () => {
    const concurrentlyChanged = [HEADER, csvRow("offer", "first contact"), csvRow("interview", "second row, unrelated")].join(
      "\n",
    );
    writeFileSync(trackerPath(), concurrentlyChanged + "\n", "utf-8");

    try {
      await updateTrackerRow(idFor(0), { status: "applied" }, { status: "interview" });
      throw new Error("expected updateTrackerRow to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(TrackerRowConflictError);
      const conflict = err as InstanceType<typeof TrackerRowConflictError>;
      expect(conflict.field).toBe("status");
      expect(conflict.expected).toBe("applied");
      expect(conflict.actual).toBe("offer");
    }
  });

  test("editing both fields with both matching succeeds and writes both", async () => {
    const updated = await updateTrackerRow(
      idFor(0),
      { status: "applied", notes: "first contact" },
      { status: "rejected", notes: "no longer interested" },
    );
    expect(updated?.status).toBe("rejected");
    expect(updated?.notes).toBe("no longer interested");
  });

  test("an unknown row id still returns null, unaffected by the new conflict check", async () => {
    const updated = await updateTrackerRow(
      "not-a-real-id",
      { status: "applied" },
      { status: "interview" },
    );
    expect(updated).toBeNull();
  });
});
