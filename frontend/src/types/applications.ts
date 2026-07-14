import type { AnalysisClassification, ApplicationStage, Domain } from './index';

export type ApplicationActionState = 'ACTIVE' | 'COMPLETED' | 'DISMISSED';

export interface ApplicationAction {
  id: string;
  job_id: string;
  label: string;
  due_at: string;
  state: ApplicationActionState;
  revision: number;
}

export interface AttentionItem {
  action: ApplicationAction;
  job: {
    id: string;
    company_name: string;
    title: string;
    application_stage: ApplicationStage;
  };
}

export interface AttentionResponse {
  overdue: AttentionItem[];
  due_today: AttentionItem[];
  upcoming: AttentionItem[];
  timezone: string;
}

interface CountRate {
  total: number;
  responses: number;
  response_rate: number | null;
}

export interface ApplicationAnalytics {
  sample_size: number;
  disclaimer: string;
  weekly_applications: { week: string; count: number }[];
  response_by_role: Record<string, CountRate>;
  response_by_source: Record<string, CountRate>;
  stage_conversion: Record<string, { count: number; rate: number | null }>;
  median_time_to_first_response_hours: number | null;
  rejection_reasons: Record<string, number>;
  outcomes_by_recommendation: Record<string, Record<string, number>>;
  outcomes_by_fit_band: Record<string, Record<string, number>>;
}

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  domain?: Domain;
  classification?: AnalysisClassification;
  source?: string;
}
