import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisStatus, type Job } from '../../types';
import { AnalysisActivity } from './AnalysisActivity';

const useJobsMock = vi.hoisted(() => vi.fn());
const invalidateJobQueriesMock = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useJobs', () => ({
  useJobs: useJobsMock,
  invalidateJobQueries: invalidateJobQueriesMock,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: toastSuccess, error: toastError },
}));

const job = (analysis_status: AnalysisStatus): Job =>
  ({
    id: 'job-1',
    company_name: 'Acme',
    title: 'Engineer',
    analysis_status,
  }) as Job;

describe('AnalysisActivity', () => {
  beforeEach(() => {
    useJobsMock.mockReset();
    invalidateJobQueriesMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('shows pending and failed jobs with links and reports terminal transitions', async () => {
    let currentJobs = [job(AnalysisStatus.PENDING)];
    useJobsMock.mockImplementation(() => ({ data: currentJobs }));
    const queryClient = new QueryClient();
    const view = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AnalysisActivity />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Analysis running');
    expect(screen.getByRole('link', { name: 'Acme — Engineer' })).toHaveAttribute(
      'href',
      '/jobs/job-1',
    );

    currentJobs = [job(AnalysisStatus.COMPLETED)];
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AnalysisActivity />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Acme analysis is ready.');
      expect(invalidateJobQueriesMock).toHaveBeenCalled();
    });

    currentJobs = [job(AnalysisStatus.FAILED)];
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AnalysisActivity />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Analysis failed');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('keeps pending links visible and exposes retry after a polling error', () => {
    const refetch = vi.fn();
    useJobsMock.mockReturnValue({
      data: [job(AnalysisStatus.PENDING)],
      isError: true,
      refetch,
    });
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AnalysisActivity />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Analysis running');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'could not be refreshed',
    );
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(refetch).toHaveBeenCalledOnce();
  });
});
