import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type {
  MasterCv,
  MasterCvUpdate,
  Settings,
  TargetProfile,
  TargetProfileState,
} from '../../types/settings';

export const useSettingsData = () => {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await apiClient.get<Settings>('/settings')).data,
  });
  const cvQuery = useQuery({
    queryKey: ['settings', 'master-cv'],
    queryFn: async () => (await apiClient.get<MasterCv>('/settings/master-cv')).data,
  });
  const targetProfileQuery = useQuery({
    queryKey: ['settings', 'target-profile'],
    queryFn: async () =>
      (await apiClient.get<TargetProfileState>('/settings/target-profile')).data,
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<Settings>) =>
      (await apiClient.patch<Settings>('/settings', settings)).data,
    onSuccess: (settings) => queryClient.setQueryData(['settings'], settings),
  });
  const saveCv = useMutation({
    mutationFn: async (input: MasterCvUpdate) =>
      (await apiClient.put<MasterCv>('/settings/master-cv', input)).data,
    onSuccess: (cv) => queryClient.setQueryData(['settings', 'master-cv'], cv),
  });
  const clearCv = useMutation({
    mutationFn: async (expected_revision: number) =>
      (await apiClient.post<MasterCv>('/settings/master-cv/clear', { expected_revision })).data,
    onSuccess: (cv) => queryClient.setQueryData(['settings', 'master-cv'], cv),
  });
  const restoreCv = useMutation({
    mutationFn: async (expected_revision: number) =>
      (await apiClient.post<MasterCv>('/settings/master-cv/restore', { expected_revision })).data,
    onSuccess: (cv) => queryClient.setQueryData(['settings', 'master-cv'], cv),
  });
  const saveTargetProfile = useMutation({
    mutationFn: async (input: {
      expected_revision: number;
      profile: TargetProfile;
    }) =>
      (
        await apiClient.put<TargetProfileState>(
          '/settings/target-profile',
          input,
        )
      ).data,
    onSuccess: (profile) =>
      queryClient.setQueryData(['settings', 'target-profile'], profile),
  });

  return {
    settingsQuery,
    cvQuery,
    targetProfileQuery,
    updateSettings,
    saveCv,
    clearCv,
    restoreCv,
    saveTargetProfile,
  };
};
