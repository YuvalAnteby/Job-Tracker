import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ApplicationStage, JobStatus } from '../types';
import { AnalysisStatus } from '../types';
import type {
  QueryClient,
  UseMutationResult,
  UseQueryResult,
} from '@tanstack/react-query';
import type {
  AnalysisRevision,
  BulkJobsResult,
  Job,
  JobFilters,
  ReanalysisResult,
} from '../types';

export interface CreateJobPayload {
  company_name: string;
  title: string;
  url: string;
  description: string;
  posted_at?: string;
}

const isJob = (value: unknown): value is Job => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && 'analysis_status' in record;
};

const markJobPending = (job: Job): Job => ({
  ...job,
  analysis_status: AnalysisStatus.PENDING,
  analysis_error: null,
});

const markCachedJobPending = (queryClient: QueryClient, id: string): void => {
  queryClient.getQueriesData<unknown>({ queryKey: ['jobs'] }).forEach(([key, data]) => {
    if (Array.isArray(data)) {
      let changed = false;
      const next = data.map((item) => {
        if (!isJob(item) || item.id !== id) return item;
        changed = true;
        return markJobPending(item);
      });
      if (changed) queryClient.setQueryData(key, next);
      return;
    }

    if (isJob(data) && data.id === id) {
      queryClient.setQueryData(key, markJobPending(data));
    }
  });
};

export const invalidateJobQueries = (queryClient: QueryClient): void => {
  void queryClient.invalidateQueries({ queryKey: ['jobs'] });
};

export const serializeJobFilters = (
  filters: JobFilters,
): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filters.domains?.length) params.domains = filters.domains.join(',');
  if (filters.statuses?.length) params.statuses = filters.statuses.join(',');
  if (filters.classifications?.length)
    params.classifications = filters.classifications.join(',');
  if (filters.fit && filters.fit !== 'all') params.fit = filters.fit;
  if (filters.search?.trim()) params.search = filters.search.trim();
  return params;
};

export const useJobs = (filters: JobFilters): UseQueryResult<Job[]> => {
  return useQuery<Job[]>({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const { data } = await apiClient.get<Job[]>('/jobs', {
        params: serializeJobFilters(filters),
      });
      return data;
    },
    placeholderData: (previous) => previous,
    refetchInterval: ({ state }) =>
      state.status !== 'error' &&
      state.data?.some(
        (job) => job.analysis_status === AnalysisStatus.PENDING,
      )
        ? 2000
        : false,
  });
};

export const useJob = (id: string): UseQueryResult<Job> => {
  return useQuery<Job>({
    queryKey: ['jobs', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Job>(`/jobs/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: ({ state }) =>
      state.status !== 'error' &&
      state.data?.analysis_status === AnalysisStatus.PENDING
        ? 2000
        : false,
  });
};

export const useCreateJob = (): UseMutationResult<
  Job,
  unknown,
  CreateJobPayload
> => {
  const queryClient = useQueryClient();

  return useMutation<Job, unknown, CreateJobPayload>({
    mutationFn: async (payload: CreateJobPayload): Promise<Job> => {
      const { data } = await apiClient.post<Job>('/jobs', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useUpdateJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Job> & { id: string }) => {
      const { data } = await apiClient.patch(`/jobs/${id}`, payload);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', variables.id] });
    },
  });
};

// Re-analyze job listing handler
export const useReanalyzeJob = () => {
  const queryClient = useQueryClient();

  return useMutation<ReanalysisResult, unknown, string>({
    mutationFn: async (id: string): Promise<ReanalysisResult> => {
      const { data } = await apiClient.post<ReanalysisResult>(
        '/jobs/reanalyze',
        { ids: [id] },
      );
      return data;
    },
    onMutate: async (id: string): Promise<void> => {
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
      markCachedJobPending(queryClient, id);
    },
    onSettled: (): void => {
      invalidateJobQueries(queryClient);
    },
  });
};

export const useAnalysisHistory = (id: string) =>
  useQuery<AnalysisRevision[]>({
    queryKey: ['jobs', id, 'analysis-history'],
    queryFn: async () =>
      (await apiClient.get<AnalysisRevision[]>(`/jobs/${id}/analysis-history`))
        .data,
    enabled: Boolean(id),
  });

export const useUpdateJobStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: JobStatus }) => {
      const { data } = await apiClient.patch(`/jobs/${id}`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useDeleteJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useBulkJobs = () => {
  const queryClient = useQueryClient();

  return useMutation<
    BulkJobsResult,
    Error,
    { ids: string[]; status?: JobStatus.APPLIED | JobStatus.INACTIVE }
  >({
    mutationFn: async ({ ids, status }) => {
      const response = status
        ? await apiClient.patch<BulkJobsResult>('/jobs/bulk/status', {
            ids,
            status,
          })
        : await apiClient.delete<BulkJobsResult>('/jobs', { data: { ids } });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

interface TransitionApplicationStageInput {
  id: string;
  new_stage: ApplicationStage;
  source?: string;
  notes?: string;
  rejection_reason?: string;
  occurred_at?: string;
  applied_at?: string;
}

export const useTransitionApplicationStage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: TransitionApplicationStageInput): Promise<Job> => {
      const { data } = await apiClient.post<Job>(
        `/jobs/${id}/application-stage`,
        payload,
      );
      return data;
    },
    onMutate: async ({ id, new_stage }) => {
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
      const previous = queryClient.getQueriesData<Job[]>({
        queryKey: ['jobs'],
      });
      previous.forEach(([key, jobs]) => {
        queryClient.setQueryData<Job[]>(
          key,
          jobs?.map((job) =>
            job.id === id ? { ...job, application_stage: new_stage } : job,
          ),
        );
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, jobs]) =>
        queryClient.setQueryData(key, jobs),
      );
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', variables.id] });
    },
  });
};
