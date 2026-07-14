import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';
import type { Domain, SkillMatrix } from '../../types';

export const useSkillsData = (domain?: Domain, includeAll = false) => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['skills', domain, includeAll],
    queryFn: async (): Promise<SkillMatrix> => {
      const response = await apiClient.get<SkillMatrix>('/skills', {
        params: { domain, include_all: includeAll },
      });
      return response.data;
    },
  });
  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['skills'] });
  const alias = useMutation({
    mutationFn: async (body: {
      alias: string;
      skill_name: string;
    }): Promise<void> => {
      await apiClient.post('/skills/aliases', body);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Taxonomy correction saved');
    },
    onError: () => toast.error('Could not save taxonomy correction'),
  });
  const rebuild = useMutation({
    mutationFn: async (): Promise<void> => {
      await apiClient.post('/skills/rebuild');
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Skill matrix rebuilt');
    },
    onError: () => toast.error('Could not rebuild skill matrix'),
  });

  return { ...query, alias, rebuild };
};
