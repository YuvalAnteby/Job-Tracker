import { useQuery, useMutation, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { GapSummary, Domain } from '../../types';
import type { CohortPreview } from '../../types';
import toast from 'react-hot-toast';

interface UseGapSummaryDataReturn {
  summary: GapSummary | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<UseQueryResult<GapSummary | null, Error>>;
  generate: () => void;
  isGenerating: boolean;
  preview: CohortPreview | undefined;
  isPreviewLoading: boolean;
}

export function useGapSummaryData(
  domain?: Domain,
  includeResearch = false,
): UseGapSummaryDataReturn {
  const query = useQuery({
    queryKey: ['gap-summary', domain],
    queryFn: async () => {
      const response = await apiClient.get<GapSummary | null>('/gap/latest', {
        params: { domain },
      });
      return response.data;
    },
  });
  const previewQuery = useQuery({
    queryKey: ['gap-cohort-preview', domain, includeResearch],
    queryFn: async () =>
      (
        await apiClient.get<CohortPreview>('/gap/preview', {
          params: { domain_filter: domain, include_research: includeResearch },
        })
      ).data,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/gap/generate', {
        domain_filter: domain,
        include_research: includeResearch,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Gap analysis enqueued successfully');
      // We don't invalidate immediately because it's a background job
      // But maybe we can start polling or just let the user refresh
    },
    onError: (error: Error) => {
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
    preview: previewQuery.data,
    isPreviewLoading: previewQuery.isLoading,
  };
}
