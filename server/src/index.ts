import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { getCvTemplate, updateCvTemplate } from "./lib/cvTemplate.js";
import {
  deleteDocument,
  deleteUpload,
  isDocumentFolder,
  listDocuments,
  listUploads,
  saveDocument,
  saveUpload,
} from "./lib/documents.js";
import { errorResponse, json } from "./lib/http.js";
import { paths } from "./lib/paths.js";
import { listPortalSkills, setPortalEnabled } from "./lib/portals.js";
import {
  getProfileData,
  ProfileSectionConflictError,
  updateProfileSection,
} from "./lib/profile.js";
import { listReports, resolveReportPath } from "./lib/reports.js";
import { listRegisteredTemplates } from "./lib/templates.js";
import {
  deleteSalaryCompany,
  getSalaryData,
  getSalaryStatus,
  searchSalary,
  updateSalaryMetadata,
  upsertSalaryCompany,
  type SalaryCompanyEntry,
  type SalaryMetadata,
} from "./lib/salary.js";
import { getSearchQueries, updateSearchQueries } from "./lib/searchQueries.js";
import { getSettings, updateSettings } from "./lib/settings.js";
import { listScrapedJobs, updateScrapedJob } from "./lib/seenJobs.js";
import {
  listTrackerRows,
  TrackerRowConflictError,
  updateTrackerRow,
} from "./lib/tracker.js";
import {
  listApplications,
  resolveApplicationFilePath,
} from "./lib/applications.js";
import { listUpskillReports } from "./lib/upskill.js";
import { runsRoutes } from "./routes/runs.js";
import { reconcileOrphanedRuns } from "./lib/runStore.js";
import {
  resolveApproval,
  resolveQuestionAnswer,
  resolveQuestionSkip,
  subscribe,
  unsubscribe,
} from "./ws/hub.js";
import {
  acquireInstanceLock,
  AnotherInstanceRunningError,
} from "./lib/instanceLock.js";

const PORT = Number(process.env.PORT ?? 4317);
const HOST = process.env.HOST ?? "127.0.0.1";

interface RunSocketData {
  runId: string;
}

try {
  await acquireInstanceLock();
} catch (err) {
  if (err instanceof AnotherInstanceRunningError) {
    console.error(`Refusing to start: ${err.message}`);
    process.exit(1);
  }
  throw err;
}

const orphanedCount = await reconcileOrphanedRuns();
if (orphanedCount > 0) {
  console.log(
    `Marked ${orphanedCount} run(s) as errored: still "running" at startup, so left over from a server process that didn't shut down cleanly.`,
  );
}

const server: Bun.Server<RunSocketData> = Bun.serve({
  port: PORT,
  hostname: HOST,
  development: false,
  error(err) {
    console.error("Unhandled route error:", err);
    return errorResponse("internal server error", 500);
  },
  routes: {
    "/api/health": () => json({ ok: true, repoRoot: paths.repoRoot }),

    "/api/jobs": {
      GET: async () => json(await listScrapedJobs()),
    },
    "/api/jobs/:key": {
      PATCH: async (req) => {
        const key = decodeURIComponent(req.params.key);
        const body = (await req.json().catch(() => null)) as Record<
          string,
          unknown
        > | null;
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          return errorResponse("invalid JSON body");
        }
        const updated = await updateScrapedJob(key, body);
        if (!updated) return errorResponse("job not found", 404);
        return json(updated);
      },
    },

    "/api/tracker": {
      GET: async () => json(await listTrackerRows()),
    },
    "/api/tracker/:id": {
      PATCH: async (req) => {
        const id = decodeURIComponent(req.params.id);
        const body = (await req.json().catch(() => null)) as {
          status?: string;
          notes?: string;
          expectedStatus?: string;
          expectedNotes?: string;
        } | null;
        if (!body) return errorResponse("invalid JSON body");
        if (body.status !== undefined && typeof body.status !== "string") {
          return errorResponse("status must be a string");
        }
        if (body.notes !== undefined && typeof body.notes !== "string") {
          return errorResponse("notes must be a string");
        }
        if (body.status !== undefined && typeof body.expectedStatus !== "string") {
          return errorResponse("expectedStatus is required when patching status");
        }
        if (body.notes !== undefined && typeof body.expectedNotes !== "string") {
          return errorResponse("expectedNotes is required when patching notes");
        }
        const patch: { status?: string; notes?: string } = {};
        const expected: { status?: string; notes?: string } = {};
        if (body.status !== undefined) {
          patch.status = body.status;
          expected.status = body.expectedStatus;
        }
        if (body.notes !== undefined) {
          patch.notes = body.notes;
          expected.notes = body.expectedNotes;
        }
        let updated: Awaited<ReturnType<typeof updateTrackerRow>>;
        try {
          updated = await updateTrackerRow(id, expected, patch);
        } catch (err) {
          if (err instanceof TrackerRowConflictError) {
            return errorResponse(err.message, 409);
          }
          throw err;
        }
        if (!updated) return errorResponse("tracker row not found", 404);
        return json(updated);
      },
    },

    "/api/applications": {
      GET: async () => json(await listApplications()),
    },
    "/api/applications/:slug/:filename": {
      GET: async (req) => {
        const slug = decodeURIComponent(req.params.slug);
        const filename = decodeURIComponent(req.params.filename);
        const filePath = resolveApplicationFilePath(slug, filename);
        if (!filePath) return errorResponse("file not found", 404);
        return new Response(Bun.file(filePath));
      },
    },

    "/api/upskill": {
      GET: async () => json(await listUpskillReports()),
    },

    "/api/salary/status": {
      GET: async () => {
        try {
          return json(await getSalaryStatus());
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    },
    "/api/salary/search": {
      GET: async (req) => {
        const url = new URL(req.url);
        const q = url.searchParams.get("q") ?? "";
        if (!q.trim()) return errorResponse("missing ?q=");
        try {
          return json(await searchSalary(q));
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
            500,
          );
        }
      },
    },
    "/api/salary/data": {
      GET: async () => {
        try {
          return json(await getSalaryData());
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    },
    "/api/salary/metadata": {
      PUT: async (req) => {
        const body = (await req
          .json()
          .catch(() => null)) as SalaryMetadata | null;
        if (!body) return errorResponse("invalid JSON body");
        try {
          return json(await updateSalaryMetadata(body));
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    },
    "/api/salary/companies": {
      POST: async (req) => {
        const body = (await req
          .json()
          .catch(() => null)) as SalaryCompanyEntry | null;
        if (!body) return errorResponse("invalid JSON body");
        try {
          return json(await upsertSalaryCompany(body), { status: 201 });
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    },
    "/api/salary/companies/:company": {
      PUT: async (req) => {
        const originalName = decodeURIComponent(req.params.company);
        const body = (await req
          .json()
          .catch(() => null)) as SalaryCompanyEntry | null;
        if (!body) return errorResponse("invalid JSON body");
        try {
          return json(await upsertSalaryCompany(body, originalName));
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
      DELETE: async (req) => {
        const company = decodeURIComponent(req.params.company);
        try {
          return json(await deleteSalaryCompany(company));
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
            404,
          );
        }
      },
    },

    "/api/profile": {
      GET: async () => json(await getProfileData()),
    },
    "/api/profile/section": {
      PATCH: async (req) => {
        const body = (await req.json().catch(() => null)) as {
          file?: string;
          sectionIndex?: number;
          expectedHeading?: string;
          content?: string;
        } | null;
        if (
          !body?.file ||
          typeof body.sectionIndex !== "number" ||
          !Number.isFinite(body.sectionIndex) ||
          typeof body.expectedHeading !== "string" ||
          typeof body.content !== "string"
        ) {
          return errorResponse(
            "body must be { file, sectionIndex, expectedHeading, content }",
          );
        }
        let warning: string | undefined;
        try {
          ({ warning } = await updateProfileSection(
            body.file,
            body.sectionIndex,
            body.expectedHeading,
            body.content,
          ));
        } catch (err) {
          if (err instanceof ProfileSectionConflictError) {
            return errorResponse(err.message, 409);
          }
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
        return json({ profile: await getProfileData(), warning });
      },
    },

    "/api/search-queries": {
      GET: async () => json({ content: await getSearchQueries() }),
      PUT: async (req) => {
        const body = (await req.json().catch(() => null)) as {
          content?: string;
        } | null;
        if (typeof body?.content !== "string")
          return errorResponse("body must be { content }");
        const content = await updateSearchQueries(body.content);
        return json({ content });
      },
    },

    "/api/cv-template": {
      GET: async () => json({ content: await getCvTemplate() }),
      PUT: async (req) => {
        const body = (await req.json().catch(() => null)) as {
          content?: string;
        } | null;
        if (typeof body?.content !== "string")
          return errorResponse("body must be { content }");
        const content = await updateCvTemplate(body.content);
        return json({ content });
      },
    },

    "/api/settings": {
      GET: async () => {
        try {
          return json(await getSettings());
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
      PUT: async (req) => {
        const body = (await req.json().catch(() => null)) as {
          allow?: string[];
        } | null;
        if (
          !Array.isArray(body?.allow) ||
          !body.allow.every((s) => typeof s === "string")
        ) {
          return errorResponse("body must be { allow: string[] }");
        }
        try {
          return json(await updateSettings(body.allow));
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    },

    "/api/documents": {
      GET: async () => json(await listDocuments()),
    },
    "/api/documents/:folder": {
      POST: async (req) => {
        const folder = decodeURIComponent(req.params.folder);
        if (!isDocumentFolder(folder)) {
          return errorResponse(
            "folder must be one of: cv, linkedin, diplomas, references, postings",
          );
        }
        const form = await req.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File))
          return errorResponse("multipart field 'file' is required");
        const MAX_SIZE = 20 * 1024 * 1024;
        if (file.size > MAX_SIZE)
          return errorResponse("file exceeds 20MB limit");
        const data = new Uint8Array(await file.arrayBuffer());
        try {
          const filename = await saveDocument(folder, file.name, data);
          return json({ folder, filename }, { status: 201 });
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    },
    "/api/documents/:folder/:filename": {
      DELETE: async (req) => {
        const folder = decodeURIComponent(req.params.folder);
        const filename = decodeURIComponent(req.params.filename);
        if (!isDocumentFolder(folder)) {
          return errorResponse(
            "folder must be one of: cv, linkedin, diplomas, references, postings",
          );
        }
        try {
          const deleted = await deleteDocument(folder, filename);
          if (!deleted) return errorResponse("file not found", 404);
          return json({ deleted: true });
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    },

    "/api/uploads/:category": {
      GET: async (req) => {
        const category = decodeURIComponent(req.params.category);
        if (category !== "cover-letter-samples")
          return errorResponse("unknown upload category");
        return json(await listUploads(category));
      },
      POST: async (req) => {
        const category = decodeURIComponent(req.params.category);
        if (category !== "cover-letter-samples")
          return errorResponse("unknown upload category");
        const form = await req.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File))
          return errorResponse("multipart field 'file' is required");
        const MAX_SIZE = 20 * 1024 * 1024;
        if (file.size > MAX_SIZE)
          return errorResponse("file exceeds 20MB limit");
        const data = new Uint8Array(await file.arrayBuffer());
        try {
          const filename = await saveUpload(category, file.name, data);
          return json({ category, filename }, { status: 201 });
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    },
    "/api/uploads/:category/:filename": {
      DELETE: async (req) => {
        const category = decodeURIComponent(req.params.category);
        const filename = decodeURIComponent(req.params.filename);
        if (category !== "cover-letter-samples")
          return errorResponse("unknown upload category");
        try {
          const deleted = await deleteUpload(category, filename);
          if (!deleted) return errorResponse("file not found", 404);
          return json({ deleted: true });
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    },

    "/api/portals": {
      GET: async () => json(await listPortalSkills()),
    },
    "/api/portals/:name": {
      PATCH: async (req) => {
        const name = decodeURIComponent(req.params.name);
        const body = (await req.json().catch(() => null)) as {
          enabled?: boolean;
        } | null;
        if (typeof body?.enabled !== "boolean") {
          return errorResponse("body must be { enabled: boolean }");
        }
        try {
          await setPortalEnabled(name, body.enabled);
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : String(err),
            404,
          );
        }
        return json(await listPortalSkills());
      },
    },

    "/api/templates": {
      GET: async () => json(await listRegisteredTemplates()),
    },

    "/api/reports": {
      GET: async () => json(await listReports()),
    },
    "/api/reports/:filename": {
      GET: async (req) => {
        const filename = decodeURIComponent(req.params.filename);
        const filePath = resolveReportPath(filename);
        if (!filePath) return errorResponse("report not found", 404);
        return new Response(Bun.file(filePath));
      },
    },

    ...runsRoutes,
  },

  fetch(req, server) {
    const url = new URL(req.url);

    const wsMatch = url.pathname.match(/^\/ws\/runs\/([^/]+)$/);
    if (wsMatch) {
      const runId = decodeURIComponent(wsMatch[1]);
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          runId,
        )
      ) {
        return new Response("invalid run id", { status: 400 });
      }
      const upgraded = server.upgrade(req, { data: { runId } });
      return upgraded
        ? undefined
        : new Response("WebSocket upgrade failed", { status: 400 });
    }

    if (!existsSync(paths.webDist)) {
      return new Response(
        "AI Job Search dashboard API is running, but the SPA isn't built.\n" +
          "For local development run `bun run dev` from dashboard/ (starts Vite separately).\n" +
          "For production, run `bun run build` from dashboard/ and restart this server.",
        { status: 404 },
      );
    }
    const requested = path.join(
      paths.webDist,
      decodeURIComponent(url.pathname),
    );
    const isRequestedFile =
      requested.startsWith(paths.webDist) &&
      existsSync(requested) &&
      statSync(requested).isFile();
    const filePath = isRequestedFile
      ? requested
      : path.join(paths.webDist, "index.html");
    return new Response(Bun.file(filePath));
  },

  websocket: {
    open(ws) {
      const { runId } = ws.data;
      subscribe(runId, ws);
    },
    close(ws) {
      const { runId } = ws.data;
      unsubscribe(runId, ws);
    },
    message(ws, raw) {
      const { runId } = ws.data;
      let msg: {
        type?: string;
        toolUseID?: string;
        message?: string;
        answers?: Record<string, string | string[]>;
      };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg.toolUseID) return;
      if (msg.type === "approve") {
        resolveApproval(runId, msg.toolUseID, true);
      } else if (msg.type === "deny") {
        resolveApproval(runId, msg.toolUseID, false, msg.message);
        resolveQuestionSkip(runId, msg.toolUseID, msg.message);
      } else if (msg.type === "answer_question" && msg.answers) {
        resolveQuestionAnswer(runId, msg.toolUseID, msg.answers);
      }
    },
  },
});

console.log(
  `AI Job Search dashboard server listening on http://${HOST}:${server.port}`,
);
console.log(`Repo root: ${paths.repoRoot}`);
