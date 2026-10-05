import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, MutationKeys, QueryKeys } from 'librechat-data-provider';
import type {
  CreatePortalAppInput,
  CreatePortalGroupInput,
  TPortalCatalog,
  UpdatePortalSettingsInput,
  UpdatePortalAppInput,
  UpdatePortalGroupInput,
} from 'librechat-data-provider';

export const usePortalFavoriteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ appId, favorite }: { appId: string; favorite: boolean }) =>
      favorite ? dataService.addPortalFavorite(appId) : dataService.removePortalFavorite(appId),
    {
      mutationKey: [MutationKeys.portalFavorite],
      onMutate: async ({ appId, favorite }) => {
        await queryClient.cancelQueries([QueryKeys.portalCatalog]);
        const previous = queryClient.getQueryData<TPortalCatalog>([QueryKeys.portalCatalog]);
        if (previous) {
          const favorites = new Set(previous.favoriteAppIds);
          favorite ? favorites.add(appId) : favorites.delete(appId);
          queryClient.setQueryData<TPortalCatalog>([QueryKeys.portalCatalog], {
            ...previous,
            favoriteAppIds: [...favorites],
          });
        }
        return { previous };
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          queryClient.setQueryData([QueryKeys.portalCatalog], context.previous);
        }
      },
      onSettled: () => queryClient.invalidateQueries([QueryKeys.portalCatalog]),
    },
  );
};

export const usePortalAdminMutations = () => {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries([QueryKeys.portalAdminCatalog]),
      queryClient.invalidateQueries([QueryKeys.portalAdminSettings]),
      queryClient.invalidateQueries([QueryKeys.portalCatalog]),
      queryClient.invalidateQueries([QueryKeys.startupConfig]),
    ]);
  };
  const createGroup = useMutation(
    (input: CreatePortalGroupInput) => dataService.createPortalGroup(input),
    { mutationKey: [MutationKeys.portalAdmin, 'createGroup'], onSuccess: refresh },
  );
  const updateGroup = useMutation(
    ({ id, input }: { id: string; input: UpdatePortalGroupInput }) =>
      dataService.updatePortalGroup(id, input),
    { mutationKey: [MutationKeys.portalAdmin, 'updateGroup'], onSuccess: refresh },
  );
  const deleteGroup = useMutation((id: string) => dataService.deletePortalGroup(id), {
    mutationKey: [MutationKeys.portalAdmin, 'deleteGroup'],
    onSuccess: refresh,
  });
  const createApp = useMutation(
    (input: CreatePortalAppInput | FormData) => dataService.createPortalApp(input),
    { mutationKey: [MutationKeys.portalAdmin, 'createApp'], onSuccess: refresh },
  );
  const updateApp = useMutation(
    ({ id, input }: { id: string; input: UpdatePortalAppInput | FormData }) =>
      dataService.updatePortalApp(id, input),
    { mutationKey: [MutationKeys.portalAdmin, 'updateApp'], onSuccess: refresh },
  );
  const deleteApp = useMutation((id: string) => dataService.deletePortalApp(id), {
    mutationKey: [MutationKeys.portalAdmin, 'deleteApp'],
    onSuccess: refresh,
  });
  const updateSettings = useMutation(
    (input: UpdatePortalSettingsInput) => dataService.updatePortalAdminSettings(input),
    { mutationKey: [MutationKeys.portalAdmin, 'updateSettings'], onSuccess: refresh },
  );
  const uploadLogo = useMutation(
    ({ type, input }: { type: 'company' | 'portal'; input: FormData }) =>
      dataService.uploadPortalLogo(type, input),
    { mutationKey: [MutationKeys.portalAdmin, 'uploadLogo'], onSuccess: refresh },
  );
  return {
    createGroup,
    updateGroup,
    deleteGroup,
    createApp,
    updateApp,
    deleteApp,
    updateSettings,
    uploadLogo,
  };
};
