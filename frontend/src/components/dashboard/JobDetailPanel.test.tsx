import type { ReactNode } from 'react';
import type { JSX } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnalysisStatus,
  ApplicationStage,
  Domain,
  JobStatus,
  ListingState,
  Recommendation,
  UserDecision,
  type Job,
} from '../../types';
import { JobDetailPanel } from './JobDetailPanel';

const useJobMock = vi.hoisted(() => vi.fn());
const useAnalysisHistoryMock = vi.hoisted(() => vi.fn());
const updateMutation = vi.hoisted(() => ({ isPending: false, mutate: vi.fn() }));
const deleteMutation = vi.hoisted(() => ({ isPending: false, mutate: vi.fn() }));
const reanalyzeMutation = vi.hoisted(() => ({ isPending: false, mutate: vi.fn() }));

vi.mock('../../hooks/useJobs', () => ({
  useJob: useJobMock,
  useAnalysisHistory: useAnalysisHistoryMock,
  useUpdateJob: () => updateMutation,
  useDeleteJob: () => deleteMutation,
  useReanalyzeJob: () => reanalyzeMutation,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

interface TestModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
}

vi.mock('../shared/Modal', () => ({
  Modal: ({ isOpen, title, children }: TestModalProps): JSX.Element | null =>
    isOpen ? <section aria-label={title}>{children}</section> : null,
}));

vi.mock('./AnalysisDetails', () => ({
  AnalysisDetails: ({ job }: { job: Job }): JSX.Element => (
    <div>{job.analysis_status}</div>
  ),
}));

const makeJob = (notes = 'saved note'): Job => ({
  id: 'job-1',
  company_name: 'Acme',
  title: 'Engineer',
  url: 'https://acme.test/job',
  description: 'Build things',
  added_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  analysis_status: AnalysisStatus.COMPLETED,
  analysis_error: null,
  analysis_model: 'test',
  prompt_version: 'test',
  analyzed_at: '2026-09-01T00:00:00.000Z',
  llm_score: 80,
  llm_is_applicable: true,
  llm_domain: Domain.BACKEND,
  llm_summary: 'A good fit',
  score_breakdown: null,
  recommendation: Recommendation.APPLY,
  suggested_classification: null,
  classification_override: null,
  effective_score: 80,
  effective_is_applicable: true,
  effective_domain: Domain.BACKEND,
  effective_classification: null,
  status: JobStatus.ACTIVE,
  listing_state: ListingState.OPEN,
  user_decision: UserDecision.UNDECIDED,
  application_stage: ApplicationStage.NOT_APPLIED,
  include_in_gap: true,
  posting_snapshot: {},
  application_events: [],
  is_interesting: true,
  notes,
  requirements: [],
});

describe('JobDetailPanel', () => {
  beforeEach(() => {
    updateMutation.mutate.mockReset();
    deleteMutation.mutate.mockReset();
    reanalyzeMutation.mutate.mockReset();
    useAnalysisHistoryMock.mockReturnValue({ data: [] });
  });

  it('preserves same-id drafts when polling refreshes the job', async () => {
    let currentJob = makeJob();
    useJobMock.mockImplementation(() => ({
      data: currentJob,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }));
    const user = userEvent.setup();
    const view = render(<JobDetailPanel jobId="job-1" onClose={vi.fn()} />);

    const notes = screen.getByRole('textbox', { name: 'Notes' });
    await user.clear(notes);
    await user.type(notes, 'draft note');

    currentJob = makeJob('server refresh');
    view.rerender(<JobDetailPanel jobId="job-1" onClose={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue(
      'draft note',
    );
  });

  it('shows a retryable query error instead of an endless spinner', () => {
    const refetch = vi.fn();
    useJobMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network down'),
      refetch,
    });

    render(<JobDetailPanel jobId="job-1" onClose={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('network down');
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(refetch).toHaveBeenCalledOnce();
  });
});
