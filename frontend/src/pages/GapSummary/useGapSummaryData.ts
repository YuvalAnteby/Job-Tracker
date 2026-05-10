import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { GapSummary, Domain } from '../../types';
import toast from 'react-hot-toast';

interface UseGapSummaryDataReturn {
  summary: GapSummary | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<UseQueryResult<GapSummary | null, Error>>;
  generate: (domainFilter?: Domain) => void;
  isGenerating: boolean;
}

export function useGapSummaryData(domain?: Domain): UseGapSummaryDataReturn {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gap-summary', domain],
    queryFn: async () => {
      const response = await apiClient.get<GapSummary | null>('/gap/latest', {
        params: { domain },
      });
      return response.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (domainFilter?: Domain) => {
      const response = await apiClient.post('/gap/generate', {
        domain_filter: domainFilter,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Gap analysis enqueued successfully');
      // We don't invalidate immediately because it's a background job
      // But maybe we can start polling or just let the user refresh
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to trigger gap analysis');
    },
  });

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    generate: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
  };
}
