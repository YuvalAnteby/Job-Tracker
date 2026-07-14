export enum JobStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  APPLIED = 'APPLIED',
  DELETED = 'DELETED',
}

export enum ListingState {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  UNKNOWN = 'UNKNOWN',
}

export enum UserDecision {
  UNDECIDED = 'UNDECIDED',
  INTERESTED = 'INTERESTED',
  APPLY = 'APPLY',
  SKIP = 'SKIP',
}

export enum ApplicationStage {
  NOT_APPLIED = 'NOT_APPLIED',
  APPLIED = 'APPLIED',
  RECRUITER_SCREEN = 'RECRUITER_SCREEN',
  TECHNICAL_INTERVIEW = 'TECHNICAL_INTERVIEW',
  ASSIGNMENT = 'ASSIGNMENT',
  ONSITE = 'ONSITE',
  OFFER = 'OFFER',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export interface ApplicationStageEvent {
  id: string;
  previous_stage: ApplicationStage;
  new_stage: ApplicationStage;
  occurred_at: string;
  recorded_at: string;
  source: string;
  notes: string | null;
  rejection_reason: string | null;
}

export enum Domain {
  BACKEND = 'BACKEND',
  FULLSTACK = 'FULLSTACK',
  ML = 'ML',
  DEVOPS = 'DEVOPS',
  OTHER = 'OTHER',
  INTERESTED = 'INTERESTED',
}

export enum MetStatus {
  MET = 'MET',
  NOT_MET = 'NOT_MET',
  UNCERTAIN = 'UNCERTAIN',
}

export enum AnalysisStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum Recommendation {
  APPLY = 'APPLY',
  STRETCH = 'STRETCH',
  RESEARCH = 'RESEARCH',
  SKIP = 'SKIP',
}

export interface ScoreBreakdown {
  hard_requirements: number;
  preferred_requirements: number;
  technical_stack: number;
  seniority_eligibility: number;
  domain_alignment: number;
  logistics_availability: number;
}

export interface JobRequirement {
  id: string;
  name: string;
  reasoning: string;
  met_status: MetStatus;
  job_description_excerpt: string | null;
  cv_evidence: string | null;
  evidence_inferred: boolean;
}

export interface Job {
  id: string;
  company_name: string;
  title: string;
  url: string;
  description: string;
  posted_at?: string;

  // LLM Results
  llm_score?: number;
  llm_is_applicable?: boolean;
  llm_domain?: Domain;
  llm_summary?: string;
  score_breakdown: ScoreBreakdown | null;
  recommendation: Recommendation | null;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
  analysis_model: string | null;
  prompt_version: string | null;
  analyzed_at: string | null;

  // Overrides
  score_override?: number;
  is_applicable_override?: boolean;
  domain_override?: Domain;

  // Virtual / Derived
  effective_score: number | null;
  effective_is_applicable: boolean;
  effective_domain: Domain;

  status: JobStatus;
  listing_state: ListingState;
  user_decision: UserDecision;
  application_stage: ApplicationStage;
  include_in_gap: boolean;
  posting_snapshot: Record<string, string | null>;
  application_events: ApplicationStageEvent[];
  is_interesting: boolean;
  notes?: string;

  requirements: JobRequirement[];

  added_at: string;
  applied_at?: string;
  updated_at: string;
}

export interface JobFilters {
  domains?: Domain[];
  statuses?: JobStatus[];
  fit?: 'all' | 'applicable' | 'interesting';
  search?: string;
}

export interface BulkJobsResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

export interface GapSummaryResult {
  domains: Record<
    string,
    {
      missing_skills: string[];
      partially_known: string[];
      gaps_detail: string;
    }
  >;
  overall_top_gaps: string[];
}

export interface GapSummary {
  id: string;
  generated_at: string;
  domain_filter: Domain | null;
  summary: GapSummaryResult;
  job_count: number;
}
