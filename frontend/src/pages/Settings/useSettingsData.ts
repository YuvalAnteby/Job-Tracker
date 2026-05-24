import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Settings } from '../../types/settings';

export const useSettingsData = () => {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<Settings>('/settings');
      return data;
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<Settings>) => {
      const { data } = await apiClient.patch('/settings', settings);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const refreshCvMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/settings/cv/refresh');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    isError: settingsQuery.isError,
    updateSettings: updateSettingsMutation.mutate,
    isUpdating: updateSettingsMutation.isPending,
    refreshCv: refreshCvMutation.mutate,
    isRefreshing: refreshCvMutation.isPending,
  };
};
