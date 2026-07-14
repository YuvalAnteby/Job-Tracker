import type { Domain } from './index';

export interface Settings {
  score_threshold: number;
  applicable_domains: Domain[];
  domain_keywords: Partial<Record<Domain, string[]>>;
  llm_provider: 'gemini';
  llm_model: string;
  telegram_allowed_chat_ids: number[];
}

export type CvSource = 'manual' | 'file' | 'legacy_url';

export interface MasterCvVersionMetadata {
  updated_at: string;
  source: CvSource;
  filename: string | null;
  word_count: number;
  character_count: number;
}

export interface MasterCv extends Omit<MasterCvVersionMetadata, 'updated_at' | 'source'> {
  content: string;
  updated_at: string | null;
  source: CvSource | null;
  revision: number;
  previous: MasterCvVersionMetadata | null;
}

export interface MasterCvUpdate {
  content: string;
  source: Exclude<CvSource, 'legacy_url'>;
  filename?: string;
  expected_revision: number;
}

export interface TargetProfile {
  target_domains: Domain[];
  target_roles: string[];
  must_have_skills: string[];
  seniority?: string;
  location?: string;
}

export interface TargetProfileState {
  revision: number;
  profile: TargetProfile;
}
