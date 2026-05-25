import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Job, JobFilters, JobStatus } from '../types';


export const useJobs = (filters: JobFilters) => {
  return useQuery<Job[]>({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/jobs', { params: filters });
      return data;
    },
  });
};

export const useJob = (id: string) => {
  return useQuery<Job>({
    queryKey: ['jobs', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/jobs/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      company_name: string;
      title: string;
      url: string;
      description: string;
      posted_at?: string;
    }) => {
      const { data } = await apiClient.post('/jobs', payload);
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
    mutationFn: async ({
      id,
      ...payload
    }: Partial<Job> & { id: string }) => {
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

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/jobs/${id}/analyze`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', id] });
    },
  });
};

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
