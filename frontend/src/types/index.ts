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

export enum AnalysisClassification {
  TARGET = 'TARGET',
  STRETCH = 'STRETCH',
  RESEARCH = 'RESEARCH',
  IRRELEVANT = 'IRRELEVANT',
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
  skill_id: string | null;
  priority: 'REQUIRED' | 'PREFERRED';
  gap_type: 'SKILL' | 'EVIDENCE' | 'TIME_BOUND' | 'ROLE_MISMATCH';
  actionability: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'SMALL' | 'MEDIUM' | 'LARGE';
}

export interface SkillOccurrence {
  requirement_id: string;
  job_id: string;
  company_name: string;
  title: string;
  requirement_text: string;
  excerpt: string | null;
  cv_evidence: string | null;
  met_status: MetStatus;
}

export interface SkillAggregate {
  id: string;
  name: string;
  required_count: number;
  preferred_count: number;
  met_count: number;
  gap_count: number;
  gap_types: JobRequirement['gap_type'][];
  actionability: JobRequirement['actionability'];
  effort: JobRequirement['effort'];
  supporting_jobs: SkillOccurrence[];
  sort_reason: string;
}

export interface SkillMatrix {
  sample_size: number;
  raw_job_count: number;
  skills: SkillAggregate[];
  non_learnable_gaps: SkillOccurrence[];
}

export enum RoadmapStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
}

export interface RoadmapProofArtifact {
  id: string;
  title: string;
  url: string | null;
  repository_url: string | null;
  notes: string | null;
  resources: string | null;
  promoted_at: string | null;
}

export interface RoadmapHistory {
  id: string;
  event: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface RoadmapItem {
  id: string;
  title: string;
  notes: string | null;
  skill_id: string | null;
  skill: { id: string; name: string } | null;
  status: RoadmapStatus;
  gap_type: JobRequirement['gap_type'];
  target_date: string | null;
  frequency: number;
  importance: number;
  relevance: number;
  evidence_weakness: number;
  effort: number;
  recommended_priority: number;
  priority_override: number | null;
  effective_priority: number;
  priority_reason: string;
  target_profile_revision: number | null;
  cv_evidence: string | null;
  jobs: Pick<Job, 'id' | 'company_name' | 'title'>[];
  requirements: JobRequirement[];
  artifacts: RoadmapProofArtifact[];
  history: RoadmapHistory[];
  semester: string;
  month: string | null;
  overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoadmapItem {
  title: string;
  skill_id?: string;
  gap_type?: JobRequirement['gap_type'];
  target_date?: string;
  effort?: number;
  relevance?: number;
  priority_override?: number;
  notes?: string;
  job_ids?: string[];
  requirement_ids?: string[];
  confirm_non_learnable?: boolean;
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
  suggested_classification: AnalysisClassification | null;
  classification_override: AnalysisClassification | null;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
  analysis_model: string | null;
  prompt_version: string | null;
  analyzed_at: string | null;
  analysis_revision_id?: string | null;
  cv_revision_id?: string | null;
  cv_revision?: number | null;

  // Overrides
  score_override?: number;
  is_applicable_override?: boolean;
  domain_override?: Domain;

  // Virtual / Derived
  effective_score: number | null;
  effective_is_applicable: boolean;
  effective_domain: Domain;
  effective_classification: AnalysisClassification | null;

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
  application_cv_revision_id?: string | null;
  updated_at: string;
}

export interface AnalysisRevision {
  id: string;
  cv_revision: number | null;
  status: AnalysisStatus;
  score: number | null;
  recommendation: Recommendation | null;
  error: string | null;
  model: string | null;
  prompt_version: string | null;
  analyzed_at: string;
}

export interface ReanalysisComparison {
  id: string;
  before: {
    score: number | null;
    recommendation: Recommendation | null;
    requirements: string[];
  };
  after: {
    score: number | null;
    recommendation: Recommendation | null;
    requirements: string[];
  };
}

export interface ReanalysisResult {
  succeeded: ReanalysisComparison[];
  failed: { id: string; error: string }[];
}

export interface JobFilters {
  domains?: Domain[];
  statuses?: JobStatus[];
  classifications?: AnalysisClassification[];
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
  job_ids: string[];
  profile_revision: number;
  cohort_options: {
    domain_filter: Domain | null;
    include_research: boolean;
  };
}

export interface CohortPreview {
  included_job_ids: string[];
  excluded: { id: string; reason: string }[];
  profile_revision: number;
  options: { domain_filter: Domain | null; include_research: boolean };
}
