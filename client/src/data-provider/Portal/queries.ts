import { useQuery } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { TPortalAdminCatalog, TPortalCatalog } from 'librechat-data-provider';
import type { TPortalSettings } from 'librechat-data-provider';

export const usePortalCatalog = (enabled = true) =>
  useQuery<TPortalCatalog, Error>([QueryKeys.portalCatalog], () => dataService.getPortalCatalog(), {
    enabled,
    refetchOnWindowFocus: false,
  });

export const usePortalAdminCatalog = (enabled = true) =>
  useQuery<TPortalAdminCatalog, Error>(
    [QueryKeys.portalAdminCatalog],
    () => dataService.getPortalAdminCatalog(),
    { enabled, refetchOnWindowFocus: false },
  );

export const usePortalAdminSettings = (enabled = true) =>
  useQuery<TPortalSettings, Error>(
    [QueryKeys.portalAdminSettings],
    () => dataService.getPortalAdminSettings(),
    { enabled, refetchOnWindowFocus: false },
  );
