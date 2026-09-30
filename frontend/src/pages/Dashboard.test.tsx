import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import {
  AnalysisStatus,
  ApplicationStage,
  Domain,
  JobStatus,
  ListingState,
  UserDecision,
  type Job,
} from '../types';
import {
  useBulkJobs,
  useDeleteJob,
  useJobs,
  useTransitionApplicationStage,
  useUpdateJob,
} from '../hooks/useJobs';
import { useAttention } from '../hooks/useApplications';

vi.mock('../components/dashboard/JobDetailPanel', () => ({
  JobDetailPanel: ({
    jobId,
  }: { jobId: string | null }): React.JSX.Element => (
    <textarea aria-label={`Detail note ${jobId ?? 'unknown'}`} />
  ),
}));

vi.mock('../hooks/useJobs', () => ({
  useBulkJobs: vi.fn(),
  useDeleteJob: vi.fn(),
  useJobs: vi.fn(),
  useTransitionApplicationStage: vi.fn(),
  useUpdateJob: vi.fn(),
}));

vi.mock('../hooks/useApplications', () => ({
  useAttention: vi.fn(),
}));

const job = (id: string, status: AnalysisStatus): Job =>
  ({
    id,
    company_name: 'Acme',
    title: 'Backend Engineer',
    analysis_status: status,
    analysis_error: status === AnalysisStatus.FAILED ? 'Model timed out.' : null,
    effective_score: status === AnalysisStatus.COMPLETED ? 82 : null,
    score_override: undefined,
    effective_domain: Domain.BACKEND,
    effective_classification: null,
    status: JobStatus.ACTIVE,
    listing_state: ListingState.OPEN,
    user_decision: UserDecision.UNDECIDED,
    application_stage: ApplicationStage.NOT_APPLIED,
    added_at: '2026-09-30T00:00:00Z',
  }) as Job;

const renderDashboard = (): void => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBulkJobs).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBulkJobs>);
    vi.mocked(useDeleteJob).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteJob>);
    vi.mocked(useTransitionApplicationStage).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useTransitionApplicationStage>);
    vi.mocked(useUpdateJob).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateJob>);
    vi.mocked(useAttention).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useAttention>);
  });

  it('shows pending and failed analysis states in the job list', () => {
    vi.mocked(useJobs).mockReturnValue({
      data: [job('pending', AnalysisStatus.PENDING), job('failed', AnalysisStatus.FAILED)],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useJobs>);

    renderDashboard();

    expect(screen.getAllByText('Analysis pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Analysis failed').length).toBeGreaterThan(0);
  });

  it('separates query errors from the empty state and retries', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    vi.mocked(useJobs).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useJobs>);

    renderDashboard();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Jobs could not be loaded.',
    );
    expect(screen.queryByText('No jobs found matching your criteria.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the mobile detail open while editing its fields', async () => {
    const user = userEvent.setup();
    vi.mocked(useJobs).mockReturnValue({
      data: [job('job-1', AnalysisStatus.COMPLETED)],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useJobs>);

    renderDashboard();

    const detailButtons = screen.getAllByRole('button', {
      name: 'View detail',
    });
    await user.click(detailButtons[detailButtons.length - 1]);
    const detailInputs = screen.getAllByRole('textbox', {
      name: 'Detail note job-1',
    });
    await user.type(detailInputs[detailInputs.length - 1], 'draft');

    expect(
      screen.getAllByRole('button', { name: 'Close detail' }).length,
    ).toBeGreaterThan(0);
  });
});
