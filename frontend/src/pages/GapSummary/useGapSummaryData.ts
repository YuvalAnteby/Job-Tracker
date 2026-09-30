import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { AnalysisStatus, Domain } from '../../types';
import type { CohortPreview, GapSummary, GapSummaryResult } from '../../types';
import toast from 'react-hot-toast';

interface GapRun extends Omit<GapSummary, 'summary'> {
  summary: GapSummaryResult | null;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
}

interface GenerationOptions {
  domain_filter?: Domain;
  include_research: boolean;
}

interface GenerationResult {
  message: string;
  cohort: CohortPreview;
  run: GapRun | null;
}

interface UseGapSummaryDataReturn {
  summary: GapSummary | null | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  generate: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
  generationError: string | null;
  preview: CohortPreview | undefined;
  isPreviewLoading: boolean;
}

export function useGapSummaryData(
  domain?: Domain,
  includeResearch = false,
): UseGapSummaryDataReturn {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['gap-summary', domain],
    queryFn: async (): Promise<GapSummary | null> =>
      (
        await apiClient.get<GapSummary | null>('/gap/latest', {
          params: { domain },
        })
      ).data,
  });
  const previewQuery = useQuery({
    queryKey: ['gap-cohort-preview', domain, includeResearch],
    queryFn: async (): Promise<CohortPreview> =>
      (
        await apiClient.get<CohortPreview>('/gap/preview', {
          params: { domain_filter: domain, include_research: includeResearch },
        })
      ).data,
  });
  const statusQuery = useQuery({
    queryKey: ['gap-generation', domain, includeResearch],
    queryFn: async (): Promise<GapRun | null> =>
      (
        await apiClient.get<GapRun | null>('/gap/status', {
          params: { domain_filter: domain, include_research: includeResearch },
        })
      ).data,
    refetchInterval: ({ state }) =>
      state.status !== 'error' &&
      state.data?.analysis_status === AnalysisStatus.PENDING
        ? 2000
        : false,
  });
  const run = statusQuery.data;

  useEffect((): void => {
    if (run?.analysis_status === AnalysisStatus.COMPLETED) {
      void client.invalidateQueries({ queryKey: ['gap-summary', domain] });
    }
  }, [client, domain, run?.id, run?.analysis_status]);

  const generateMutation = useMutation<
    GenerationResult,
    Error,
    GenerationOptions
  >({
    mutationFn: async (options): Promise<GenerationResult> =>
      (await apiClient.post<GenerationResult>('/gap/generate', options)).data,
    onSuccess: (data, options): void => {
      client.setQueryData(
        ['gap-generation', options.domain_filter, options.include_research],
        data.run,
      );
      toast.success(
        data.run
          ? 'Gap analysis is running. You can keep working.'
          : 'No jobs match this cohort.',
      );
    },
  });
  const isCurrentMutation =
    generateMutation.variables?.domain_filter === domain &&
    generateMutation.variables?.include_research === includeResearch;
  const isGenerating =
    (isCurrentMutation && generateMutation.isPending) ||
    run?.analysis_status === AnalysisStatus.PENDING;

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError || statusQuery.isError || previewQuery.isError,
    refetch: (): void => {
      void query.refetch();
      void statusQuery.refetch();
      void previewQuery.refetch();
    },
    generate: (): void =>
      generateMutation.mutate({
        domain_filter: domain,
        include_research: includeResearch,
      }),
    isGenerating,
    canGenerate:
      !isGenerating &&
      !statusQuery.isPending &&
      !statusQuery.isError &&
      !previewQuery.isError &&
      Boolean(previewQuery.data?.included_job_ids.length),
    generationError:
      (isCurrentMutation ? generateMutation.error?.message : null) ||
      (run?.analysis_status === AnalysisStatus.FAILED
        ? run.analysis_error || 'Gap analysis failed. Please retry.'
        : null),
    preview: previewQuery.data,
    isPreviewLoading: previewQuery.isLoading,
  };
}
