import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useJobs, useTransitionApplicationStage } from './useJobs';
import { AnalysisStatus, ApplicationStage, type Job } from '../types';

const post = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
vi.mock('../api/client', () => ({ apiClient: { get, post } }));

interface WrapperProps {
  children: ReactNode;
}

describe('useTransitionApplicationStage', () => {
  it('restores cached jobs when a transition fails', async () => {
    let rejectRequest: (reason?: unknown) => void = () => undefined;
    post.mockReturnValue(new Promise((_resolve, reject) => { rejectRequest = reject; }));
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const job = { id: 'job-1', application_stage: ApplicationStage.NOT_APPLIED } as Job;
    queryClient.setQueryData(['jobs', {}], [job]);
    const wrapper = ({ children }: WrapperProps): ReactNode => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useTransitionApplicationStage(), { wrapper });

    act(() => result.current.mutate({ id: job.id, new_stage: ApplicationStage.APPLIED }));
    await waitFor(() => expect(queryClient.getQueryData<Job[]>(['jobs', {}])?.[0].application_stage).toBe(ApplicationStage.APPLIED));
    act(() => rejectRequest(new Error('network failed')));
    await waitFor(() => expect(queryClient.getQueryData<Job[]>(['jobs', {}])?.[0].application_stage).toBe(ApplicationStage.NOT_APPLIED));
  });
});

describe('useJobs polling', () => {
  it('polls pending jobs until the analysis reaches a terminal state', async () => {
    vi.useFakeTimers();
    const pendingJob = {
      id: 'job-1',
      analysis_status: AnalysisStatus.PENDING,
    } as Job;
    const completedJob = {
      ...pendingJob,
      analysis_status: AnalysisStatus.COMPLETED,
    } as Job;
    get.mockResolvedValueOnce({ data: [pendingJob] });
    get.mockResolvedValueOnce({ data: [completedJob] });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const wrapper = ({ children }: WrapperProps): ReactNode => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useJobs({}), { wrapper });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data?.[0].analysis_status).toBe(
      AnalysisStatus.PENDING,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
      await Promise.resolve();
    });
    expect(result.current.data?.[0].analysis_status).toBe(
      AnalysisStatus.COMPLETED,
    );
    expect(get).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
