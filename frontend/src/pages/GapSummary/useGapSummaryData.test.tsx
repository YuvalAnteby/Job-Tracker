import { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisStatus } from '../../types';
import { useGapSummaryData } from './useGapSummaryData';

const get = vi.hoisted(() => vi.fn());
vi.mock('../../api/client', () => ({ apiClient: { get, post: vi.fn() } }));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => vi.useRealTimers());

describe('gap generation tracking', () => {
  it.each([AnalysisStatus.COMPLETED, AnalysisStatus.FAILED])(
    'restores a pending run on revisit and stops polling at %s without losing the previous summary',
    async (terminal) => {
      const oldSummary = {
        id: 'previous',
        summary: { domains: {}, overall_top_gaps: [] },
      };
      let status = AnalysisStatus.PENDING;
      let statusReads = 0;
      get.mockImplementation(
        async (url: string): Promise<{ data: unknown }> => {
          if (url === '/gap/status') {
            statusReads++;
            return {
              data: {
                id: 'run-1',
                analysis_status: status,
                analysis_error:
                  status === AnalysisStatus.FAILED
                    ? 'Provider unavailable'
                    : null,
              },
            };
          }
          if (url === '/gap/preview')
            return { data: { included_job_ids: ['job-1'], excluded: [] } };
          return {
            data:
              status === AnalysisStatus.COMPLETED
                ? { ...oldSummary, id: 'run-1' }
                : oldSummary,
          };
        },
      );
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const view = renderHook(() => useGapSummaryData(), { wrapper });
      await waitFor(() => expect(view.result.current.isGenerating).toBe(true));
      expect(view.result.current.summary).toEqual(oldSummary);

      // Remount starts a fresh poll timer under the fake clock.
      view.unmount();
      vi.useFakeTimers();
      const resumed = renderHook(() => useGapSummaryData(), { wrapper });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      status = terminal;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2050);
      });
      expect(resumed.result.current.isGenerating).toBe(false);
      expect(resumed.result.current.summary?.id).toBe(
        terminal === AnalysisStatus.COMPLETED ? 'run-1' : 'previous',
      );
      const readsAtCompletion = statusReads;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(statusReads).toBe(readsAtCompletion);
      resumed.unmount();
      client.clear();
    },
  );
});
