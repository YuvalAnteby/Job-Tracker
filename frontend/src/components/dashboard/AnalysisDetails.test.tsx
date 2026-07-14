import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AnalysisStatus,
  ApplicationStage,
  Domain,
  Job,
  JobStatus,
  ListingState,
  MetStatus,
  Recommendation,
  UserDecision,
} from '../../types';
import { AnalysisDetails } from './AnalysisDetails';

const job = (status: AnalysisStatus): Job => ({
  id: 'job-1',
  company_name: 'Acme',
  title: 'Engineer',
  url: 'https://example.com',
  description: 'TypeScript role',
  score_breakdown:
    status === AnalysisStatus.COMPLETED
      ? {
          hard_requirements: 80,
          preferred_requirements: 70,
          technical_stack: 80,
          seniority_eligibility: 90,
          domain_alignment: 80,
          logistics_availability: 90,
        }
      : null,
  recommendation: Recommendation.APPLY,
  analysis_status: status,
  analysis_error:
    status === AnalysisStatus.FAILED ? 'Invalid model output.' : null,
  analysis_model: 'gemini-test',
  prompt_version: 'job-analysis-v2',
  analyzed_at: '2026-07-14T00:00:00Z',
  llm_summary: 'Strong fit.',
  effective_score: 82,
  effective_is_applicable: true,
  effective_domain: Domain.BACKEND,
  status: JobStatus.ACTIVE,
  listing_state: ListingState.OPEN,
  user_decision: UserDecision.UNDECIDED,
  application_stage: ApplicationStage.NOT_APPLIED,
  include_in_gap: true,
  posting_snapshot: {},
  application_events: [],
  is_interesting: true,
  requirements: [
    {
      id: 'requirement-1',
      name: 'TypeScript',
      reasoning: 'Used professionally.',
      met_status: MetStatus.MET,
      job_description_excerpt: null,
      cv_evidence: 'Built TypeScript services.',
      evidence_inferred: false,
    },
  ],
  added_at: '2026-07-14T00:00:00Z',
  updated_at: '2026-07-14T00:00:00Z',
});

describe('AnalysisDetails', () => {
  it('shows pending and failed states', () => {
    const { rerender } = render(
      <AnalysisDetails
        job={job(AnalysisStatus.PENDING)}
        onRetry={vi.fn()}
        retrying={false}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Analysis in progress',
    );
    rerender(
      <AnalysisDetails
        job={job(AnalysisStatus.FAILED)}
        onRetry={vi.fn()}
        retrying={false}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Analysis failed');
  });

  it('shows completed dimensions and requirement evidence', () => {
    render(
      <AnalysisDetails
        job={job(AnalysisStatus.COMPLETED)}
        onRetry={vi.fn()}
        retrying={false}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Score breakdown' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /TypeScript/ }));
    expect(screen.getByText(/Built TypeScript services/)).toBeInTheDocument();
  });

  it('marks legacy results as incomplete', () => {
    const legacy = job(AnalysisStatus.COMPLETED);
    legacy.score_breakdown = null;
    render(<AnalysisDetails job={legacy} onRetry={vi.fn()} retrying={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Analysis incomplete');
  });
});
