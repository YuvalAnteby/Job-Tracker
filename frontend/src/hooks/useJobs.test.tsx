import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useTransitionApplicationStage } from './useJobs';
import { ApplicationStage, type Job } from '../types';

const post = vi.hoisted(() => vi.fn());
vi.mock('../api/client', () => ({ apiClient: { post } }));

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
