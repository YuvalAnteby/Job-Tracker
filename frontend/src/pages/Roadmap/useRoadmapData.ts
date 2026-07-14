import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';
import {
  type CreateRoadmapItem,
  type RoadmapItem,
  type RoadmapProofArtifact,
  type RoadmapStatus,
} from '../../types';

export interface ProofArtifactInput {
  title: string;
  url?: string;
  repository_url?: string;
  notes?: string;
  resources?: string;
}

export const useCreateRoadmapItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateRoadmapItem): Promise<RoadmapItem> =>
      (await apiClient.post<RoadmapItem>('/roadmap', body)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      toast.success('Added to roadmap');
    },
    onError: () => toast.error('Could not add roadmap item'),
  });
};

export const useRoadmapData = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['roadmap'],
    queryFn: async (): Promise<RoadmapItem[]> =>
      (await apiClient.get<RoadmapItem[]>('/roadmap')).data,
  });
  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['roadmap'] });
  const update = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: {
        status?: RoadmapStatus;
        target_date?: string;
        priority_override?: number;
        notes?: string;
      };
    }): Promise<RoadmapItem> =>
      (await apiClient.patch<RoadmapItem>(`/roadmap/${id}`, body)).data,
    onSuccess: async () => {
      await invalidate();
      toast.success('Roadmap updated');
    },
    onError: () => toast.error('Could not update roadmap'),
  });
  const addArtifact = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: ProofArtifactInput;
    }): Promise<RoadmapProofArtifact> =>
      (
        await apiClient.post<RoadmapProofArtifact>(
          `/roadmap/${id}/artifacts`,
          body,
        )
      ).data,
    onSuccess: async () => {
      await invalidate();
      toast.success('Proof attached');
    },
    onError: () => toast.error('Could not attach proof'),
  });
  const promote = useMutation({
    mutationFn: async ({
      id,
      artifactId,
    }: {
      id: string;
      artifactId: string;
    }): Promise<RoadmapItem> =>
      (
        await apiClient.post<RoadmapItem>(
          `/roadmap/${id}/artifacts/${artifactId}/promote`,
        )
      ).data,
    onSuccess: async () => {
      await invalidate();
      toast.success('Proof promoted to CV evidence');
    },
    onError: () => toast.error('Could not promote proof'),
  });

  return { ...query, update, addArtifact, promote };
};
