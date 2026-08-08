import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mockPaths } from "./helpers/mockPaths.js";

const {
  deleteDocument,
  deleteUpload,
  isDocumentFolder,
  listDocuments,
  listUploads,
  saveDocument,
  saveUpload,
} = await import("../src/lib/documents.js");

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(path.join(tmpdir(), "documents-test-"));
  mockPaths.repoRoot = testDir;
  mockPaths.uploadsDir = path.join(testDir, ".uploads");
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("isDocumentFolder", () => {
  test("accepts the five known folders and rejects anything else", () => {
    for (const folder of ["cv", "linkedin", "diplomas", "references", "postings"]) {
      expect(isDocumentFolder(folder)).toBe(true);
    }
    expect(isDocumentFolder("applications")).toBe(false);
    expect(isDocumentFolder("")).toBe(false);
  });
});

describe("documents (cv/linkedin/diplomas/references/postings)", () => {
  test("listDocuments returns an empty array per folder when nothing exists yet", async () => {
    expect(await listDocuments()).toEqual({
      cv: [],
      linkedin: [],
      diplomas: [],
      references: [],
      postings: [],
    });
  });

  test("saveDocument creates the folder, sanitizes the filename, and shows up in listDocuments", async () => {
    const saved = await saveDocument("cv", "My Résumé!.pdf", new Uint8Array([1, 2, 3]));
    expect(saved).toBe("My R_sum__.pdf");
    const listed = await listDocuments();
    expect(listed.cv).toEqual([saved]);
  });

  test("deleteDocument removes a file that exists and returns false for one that doesn't", async () => {
    await saveDocument("linkedin", "export.pdf", new Uint8Array([1]));
    expect(await deleteDocument("linkedin", "export.pdf")).toBe(true);
    expect(await deleteDocument("linkedin", "export.pdf")).toBe(false);
    expect((await listDocuments()).linkedin).toEqual([]);
  });

  test("saveDocument reduces a path-traversal filename to its safe basename instead of escaping the folder", async () => {
    const saved = await saveDocument("cv", "../../evil.txt", new Uint8Array([1]));
    expect(saved).toBe("evil.txt");
    expect((await listDocuments()).cv).toContain("evil.txt");
  });
});

describe("uploads (this dashboard's own working files, e.g. cover-letter-samples)", () => {
  test("round-trips a saved upload through list and delete", async () => {
    mkdirSync(mockPaths.uploadsDir, { recursive: true });
    const saved = await saveUpload("cover-letter-samples", "sample.tex", new Uint8Array([9]));
    expect(await listUploads("cover-letter-samples")).toEqual([saved]);
    expect(await deleteUpload("cover-letter-samples", saved)).toBe(true);
    expect(await listUploads("cover-letter-samples")).toEqual([]);
  });

  test("listUploads returns [] for a category directory that doesn't exist", async () => {
    expect(await listUploads("never-created")).toEqual([]);
  });
});
