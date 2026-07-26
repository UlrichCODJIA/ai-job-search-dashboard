import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "./client";
import type { SalaryCompanyEntry, SalaryMetadata } from "./types";

export const queryKeys = {
  jobs: ["jobs"] as const,
  tracker: ["tracker"] as const,
  applications: ["applications"] as const,
  upskill: ["upskill"] as const,
  salaryStatus: ["salary", "status"] as const,
  salarySearch: (q: string) => ["salary", "search", q] as const,
  salaryData: ["salary", "data"] as const,
  profile: ["profile"] as const,
  searchQueries: ["searchQueries"] as const,
  settings: ["settings"] as const,
  documents: ["documents"] as const,
  uploads: (category: string) => ["uploads", category] as const,
  portals: ["portals"] as const,
  reports: ["reports"] as const,
  runs: ["runs"] as const,
  run: (id: string) => ["runs", id] as const,
  runLog: (id: string) => ["runs", id, "log"] as const,
};

export function useJobs() {
  return useQuery({ queryKey: queryKeys.jobs, queryFn: api.jobs.list });
}

export function useDismissJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.jobs.update(key, { status: "skipped" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs }),
  });
}

export function useTracker() {
  return useQuery({ queryKey: queryKeys.tracker, queryFn: api.tracker.list });
}

export function useUpdateTrackerRow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      patch: { status?: string; notes?: string };
    }) => api.tracker.update(args.id, args.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tracker });
      queryClient.invalidateQueries({ queryKey: queryKeys.applications });
    },
  });
}

export function useApplications() {
  return useQuery({
    queryKey: queryKeys.applications,
    queryFn: api.applications.list,
  });
}

export function useUpskillReports() {
  return useQuery({ queryKey: queryKeys.upskill, queryFn: api.upskill.list });
}

export function useSalaryStatus() {
  return useQuery({
    queryKey: queryKeys.salaryStatus,
    queryFn: api.salary.status,
  });
}

export function useSalaryData() {
  return useQuery({ queryKey: queryKeys.salaryData, queryFn: api.salary.data });
}

function invalidateSalary(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.salaryData });
  queryClient.invalidateQueries({ queryKey: queryKeys.salaryStatus });
}

export function useUpdateSalaryMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (metadata: SalaryMetadata) =>
      api.salary.updateMetadata(metadata),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.salaryData, data);
      invalidateSalary(queryClient);
    },
  });
}

export function useCreateSalaryCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: SalaryCompanyEntry) => api.salary.createCompany(entry),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.salaryData, data);
      invalidateSalary(queryClient);
    },
  });
}

export function useUpdateSalaryCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { originalName: string; entry: SalaryCompanyEntry }) =>
      api.salary.updateCompany(args.originalName, args.entry),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.salaryData, data);
      invalidateSalary(queryClient);
    },
  });
}

export function useDeleteSalaryCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.salary.deleteCompany(name),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.salaryData, data);
      invalidateSalary(queryClient);
    },
  });
}

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile, queryFn: api.profile.get });
}

export function useUpdateProfileSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      file: string;
      sectionIndex: number;
      content: string;
    }) => api.profile.updateSection(args.file, args.sectionIndex, args.content),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.profile, data),
  });
}

export function useSearchQueries() {
  return useQuery({
    queryKey: queryKeys.searchQueries,
    queryFn: api.searchQueries.get,
  });
}

export function useUpdateSearchQueries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.searchQueries.update(content),
    onSuccess: (data) =>
      queryClient.setQueryData(queryKeys.searchQueries, data),
  });
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: api.settings.get });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allow: string[]) => api.settings.update(allow),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.settings, data),
  });
}

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents,
    queryFn: api.documents.list,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { folder: string; file: File }) =>
      api.documents.upload(args.folder, args.file),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.documents }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { folder: string; filename: string }) =>
      api.documents.remove(args.folder, args.filename),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.documents }),
  });
}

export function useUploads(category: string) {
  return useQuery({
    queryKey: queryKeys.uploads(category),
    queryFn: () => api.uploads.list(category),
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { category: string; file: File }) =>
      api.uploads.upload(args.category, args.file),
    onSuccess: (_data, args) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.uploads(args.category),
      }),
  });
}

export function usePortalSkills() {
  return useQuery({ queryKey: queryKeys.portals, queryFn: api.portals.list });
}

export function useReports() {
  return useQuery({ queryKey: queryKeys.reports, queryFn: api.reports.list });
}

export function useRuns() {
  return useQuery({
    queryKey: queryKeys.runs,
    queryFn: api.runs.list,
    refetchInterval: 5000,
  });
}

export function useRun(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.run(id ?? ""),
    queryFn: () => api.runs.get(id as string),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });
}

export function useLaunchRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      command: string;
      args?: string;
      resumeKey?: string;
    }) => api.runs.start(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.runs }),
  });
}

export function useStopRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.runs.stop(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.runs });
      queryClient.invalidateQueries({ queryKey: queryKeys.run(id) });
    },
  });
}

export function useReplyToRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; message: string }) =>
      api.runs.reply(args.id, args.message),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.runs }),
  });
}

export function useRunLogs(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.runLog(id),
      queryFn: () => api.runs.log(id),
    })),
  });
}
