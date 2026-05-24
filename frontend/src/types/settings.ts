import { Domain } from './index';

export interface Settings {
  score_threshold: number;
  applicable_domains: Domain[];
  domain_keywords: Record<Domain, string[]>;
  llm_provider: string;
  llm_model: string;
  telegram_allowed_chat_ids: number[];
  master_cv_url: string;
  master_cv_cached_text: string;
  master_cv_cached_at: string | null;
}
