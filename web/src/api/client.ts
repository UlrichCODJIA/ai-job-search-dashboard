import type { RunEvent, RunPermissionMode, RunRecord } from "./runTypes";
import type {
  ApplicationRecord,
  PortalSkill,
  ProfileData,
  RegisteredTemplate,
  ReportFile,
  SalaryCompanyEntry,
  SalaryData,
  SalaryMetadata,
  SalaryStatus,
  ScrapedJob,
  TrackerRow,
  UpskillReport,
} from "./types";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(path, {
    ...init,
    headers: isFormData
      ? (init?.headers ?? {})
      : { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      body?.error ?? `${path} failed with ${res.status}`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

export const api = {
  setup: {
    get: () =>
      request<{ configured: boolean; repoRoot: string | null }>("/api/setup"),
    save: (repoRoot: string) =>
      request<{ saved: boolean; repoRoot: string }>("/api/setup", {
        method: "POST",
        body: JSON.stringify({ repoRoot }),
      }),
  },

  jobs: {
    list: () => request<ScrapedJob[]>("/api/jobs"),
    update: (key: string, patch: Record<string, unknown>) =>
      request<ScrapedJob>(`/api/jobs/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
  },

  tracker: {
    list: () => request<TrackerRow[]>("/api/tracker"),
    update: (
      id: string,
      patch: { status?: string; notes?: string },
      expected: { expectedStatus?: string; expectedNotes?: string },
    ) =>
      request<TrackerRow>(`/api/tracker/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...patch, ...expected }),
      }),
  },

  applications: {
    list: () => request<ApplicationRecord[]>("/api/applications"),
  },

  upskill: {
    list: () => request<UpskillReport[]>("/api/upskill"),
  },

  salary: {
    status: () => request<SalaryStatus>("/api/salary/status"),
    search: (query: string) =>
      request<unknown>(`/api/salary/search?q=${encodeURIComponent(query)}`),
    data: () => request<SalaryData>("/api/salary/data"),
    updateMetadata: (metadata: SalaryMetadata) =>
      request<SalaryData>("/api/salary/metadata", {
        method: "PUT",
        body: JSON.stringify(metadata),
      }),
    createCompany: (entry: SalaryCompanyEntry) =>
      request<SalaryData>("/api/salary/companies", {
        method: "POST",
        body: JSON.stringify(entry),
      }),
    updateCompany: (originalName: string, entry: SalaryCompanyEntry) =>
      request<SalaryData>(
        `/api/salary/companies/${encodeURIComponent(originalName)}`,
        {
          method: "PUT",
          body: JSON.stringify(entry),
        },
      ),
    deleteCompany: (name: string) =>
      request<SalaryData>(`/api/salary/companies/${encodeURIComponent(name)}`, {
        method: "DELETE",
      }),
  },

  profile: {
    get: () => request<ProfileData>("/api/profile"),
    updateSection: (file: string, sectionIndex: number, expectedHeading: string, content: string) =>
      request<{ profile: ProfileData; warning?: string }>("/api/profile/section", {
        method: "PATCH",
        body: JSON.stringify({ file, sectionIndex, expectedHeading, content }),
      }),
  },

  searchQueries: {
    get: () => request<{ content: string }>("/api/search-queries"),
    update: (content: string) =>
      request<{ content: string }>("/api/search-queries", {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),
  },

  cvTemplate: {
    get: () => request<{ content: string }>("/api/cv-template"),
    update: (content: string) =>
      request<{ content: string }>("/api/cv-template", {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),
  },

  settings: {
    get: () => request<{ allow: string[] }>("/api/settings"),
    update: (allow: string[]) =>
      request<{ allow: string[] }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ allow }),
      }),
  },

  documents: {
    list: () => request<Record<string, string[]>>("/api/documents"),
    upload: (folder: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ folder: string; filename: string }>(
        `/api/documents/${encodeURIComponent(folder)}`,
        {
          method: "POST",
          body: form,
        },
      );
    },
    remove: (folder: string, filename: string) =>
      request<{ deleted: boolean }>(
        `/api/documents/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      ),
  },

  uploads: {
    list: (category: string) =>
      request<string[]>(`/api/uploads/${encodeURIComponent(category)}`),
    upload: (category: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ category: string; filename: string }>(
        `/api/uploads/${encodeURIComponent(category)}`,
        {
          method: "POST",
          body: form,
        },
      );
    },
    remove: (category: string, filename: string) =>
      request<{ deleted: boolean }>(
        `/api/uploads/${encodeURIComponent(category)}/${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      ),
  },

  portals: {
    list: () => request<PortalSkill[]>("/api/portals"),
    setEnabled: (name: string, enabled: boolean) =>
      request<PortalSkill[]>(`/api/portals/${encodeURIComponent(name)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
  },

  templates: {
    list: () => request<RegisteredTemplate[]>("/api/templates"),
  },

  reports: {
    list: () => request<ReportFile[]>("/api/reports"),
  },

  runs: {
    list: () => request<RunRecord[]>("/api/runs"),
    get: (id: string) =>
      request<RunRecord>(`/api/runs/${encodeURIComponent(id)}`),
    start: (body: {
      command: string;
      args?: string;
      resumeKey?: string;
      permissionMode?: RunPermissionMode;
    }) =>
      request<{ runId: string }>("/api/runs", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    stop: (id: string) =>
      request<{ stopped: boolean }>(
        `/api/runs/${encodeURIComponent(id)}/stop`,
        { method: "POST" },
      ),
    delete: (id: string) =>
      request<{ deletedIds: string[] }>(`/api/runs/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    reply: (id: string, message: string) =>
      request<{ runId: string }>(`/api/runs/${encodeURIComponent(id)}/reply`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    log: (id: string) =>
      request<RunEvent[]>(`/api/runs/${encodeURIComponent(id)}/log`),
  },
};

export { ApiError };
