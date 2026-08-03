export interface ReferralLinks {
  recruiters: string;
  team_peers: string;
}

export interface ScrapedJob {
  key: string;
  title: string;
  company: string;
  url: string;
  first_seen: string;
  fit: "high" | "medium" | "low" | string;
  status: "new" | "skipped" | "evaluated" | "ranked" | "expired" | string;
  location?: string | null;
  deadline?: string | null;
  salary?: string | null;
  highlights?: string[] | null;
  referral_links?: ReferralLinks | null;
  rank_score?: number;
  rank_verdict?: string;
  rank_date?: string;
  rank_strengths?: string[];
  rank_gaps?: string[];
  rank_deadline?: string | null;
  rank_location?: "PASS" | "FAIL" | "FLAG" | string;
  [extra: string]: unknown;
}

export type StatusBucket =
  | "Active"
  | "Interview"
  | "Offer"
  | "Hired"
  | "Rejected/Closed";

export interface TrackerRow {
  id: string;
  bucket: StatusBucket;
  date: string;
  company: string;
  sector: string;
  role: string;
  role_type: string;
  channel: string;
  status: string;
  contact_person: string;
  fit_rating: string;
  notes: string;
  cv_file: string;
  cover_letter_file: string;
  source: string;
  [extra: string]: string | undefined;
}

export interface OutcomeStage {
  label: string;
  checked: boolean;
  date?: string;
}

export interface OutcomeRecord {
  status: string;
  dateResolved?: string;
  stages: OutcomeStage[];
  notes: string;
}

export interface ApplicationRecord {
  slug: string;
  companySlug: string;
  roleSlug: string;
  outcome: OutcomeRecord | null;
  hasJobPosting: boolean;
  hasCvDraft: boolean;
  hasCoverLetter: boolean;
  trackerRow: TrackerRow | null;
}

export interface GapHeatmapRow {
  priority: string;
  skill: string;
  type: string;
  gapSource: string;
}

export interface StudyOrderRow {
  order: string;
  topic: string;
  type: string;
  estTime: string;
  note: string;
}

export interface UpskillReport {
  filename: string;
  date: string;
  mode: string;
  sinceLastReport: string | null;
  gapHeatmap: GapHeatmapRow[];
  learningPlanRaw: string;
  suggestedStudyOrder: StudyOrderRow[];
  totalEstimatedTime: string | null;
}

export interface SalaryStatus {
  available: boolean;
  metadata?: Record<string, unknown>;
  companyCount?: number;
}

export interface SalaryCategory {
  count?: number;
  index?: number;
}

export interface SalaryCompanyEntry {
  company: string;
  city?: string;
  categories?: Record<string, SalaryCategory>;
}

export interface SalaryMetadata {
  source?: string;
  index_baseline?: number;
  index_label?: string;
  baseline_description?: string;
}

export interface SalaryData {
  metadata: SalaryMetadata;
  companies: SalaryCompanyEntry[];
}

export interface PortalSkill {
  name: string;
  descriptionPreview: string;
  enabled: boolean;
}

export interface ReportFile {
  filename: string;
  modifiedAt: number;
}

export interface MarkdownSection {
  level: number;
  heading: string;
  content: string;
}

export interface PlaceholderHit {
  file: string;
  match: string;
  line: number;
}

export interface ProfileData {
  name: string | null;
  claudeMdSections: MarkdownSection[];
  skillFiles: { filename: string; sections: MarkdownSection[] }[];
  placeholders: PlaceholderHit[];
}
