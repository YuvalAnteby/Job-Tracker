export enum JobStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  APPLIED = 'APPLIED',
  DELETED = 'DELETED',
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

export interface JobRequirement {
  id: string;
  name: string;
  reasoning: string;
  met_status: MetStatus;
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
  
  // Overrides
  score_override?: number;
  is_applicable_override?: boolean;
  domain_override?: Domain;
  
  // Virtual / Derived
  effective_score: number;
  effective_is_applicable: boolean;
  effective_domain: Domain;
  
  status: JobStatus;
  is_interesting: boolean;
  notes?: string;
  
  requirements: JobRequirement[];
  
  added_at: string;
  updated_at: string;
}

export interface JobFilters {
  domains?: Domain[];
  statuses?: JobStatus[];
  fit?: 'all' | 'applicable' | 'interesting';
  search?: string;
}
