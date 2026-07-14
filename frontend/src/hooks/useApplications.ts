import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type {
  AnalyticsFilters,
  ApplicationAction,
  ApplicationAnalytics,
  AttentionResponse,
} from '../types/applications';
import type { Settings } from '../types/settings';

const params = (filters: AnalyticsFilters): URLSearchParams => {
  const result = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) result.set(key, value);
  });
  return result;
};

export const useAttention = () =>
  useQuery({
    queryKey: ['applications', 'attention'],
    queryFn: async (): Promise<AttentionResponse> =>
      (await apiClient.get<AttentionResponse>('/applications/attention')).data,
  });

export const useReminderDefaults = () =>
  useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<Settings> =>
      (await apiClient.get<Settings>('/settings')).data,
  });

export const useApplicationAnalytics = (filters: AnalyticsFilters) =>
  useQuery({
    queryKey: ['applications', 'analytics', filters],
    queryFn: async (): Promise<ApplicationAnalytics> =>
      (
        await apiClient.get<ApplicationAnalytics>(
          `/applications/analytics?${params(filters)}`,
        )
      ).data,
  });

export const useApplicationActions = () => {
  const queryClient = useQueryClient();
  const refresh = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['applications'] });
  const schedule = useMutation({
    mutationFn: async (input: {
      jobId: string;
      label: string;
      due_at?: string;
    }): Promise<ApplicationAction> =>
      (
        await apiClient.put<ApplicationAction>(
          `/applications/${input.jobId}/action`,
          { label: input.label, due_at: input.due_at },
        )
      ).data,
    onSuccess: refresh,
  });
  const reschedule = useMutation({
    mutationFn: async (input: {
      jobId: string;
      due_at: string;
    }): Promise<ApplicationAction> =>
      (
        await apiClient.post<ApplicationAction>(
          `/applications/${input.jobId}/action/reschedule`,
          { due_at: input.due_at },
        )
      ).data,
    onSuccess: refresh,
  });
  const finish = useMutation({
    mutationFn: async (input: {
      jobId: string;
      outcome: 'complete' | 'dismiss';
    }): Promise<ApplicationAction> =>
      (
        await apiClient.post<ApplicationAction>(
          `/applications/${input.jobId}/action/${input.outcome}`,
        )
      ).data,
    onSuccess: refresh,
  });
  return { schedule, reschedule, finish };
};

export const downloadAnalyticsCsv = async (
  filters: AnalyticsFilters,
): Promise<void> => {
  const response = await apiClient.get<Blob>(
    `/applications/analytics/export?${params(filters)}`,
    { responseType: 'blob' },
  );
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'application-analytics.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};
