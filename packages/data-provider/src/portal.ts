import { z } from 'zod';

export const portalPresetIcons = [
  'app',
  'chart',
  'database',
  'document',
  'folder',
  'workflow',
  'dashboard',
  'link',
  'robot',
  'settings',
  'users',
  'finance',
] as const;

export const portalIconTypes = ['preset', 'upload'] as const;
export const portalOpenModes = ['new_tab'] as const;

export type PortalPresetIcon = (typeof portalPresetIcons)[number];
export type PortalIconType = (typeof portalIconTypes)[number];
export type PortalOpenMode = (typeof portalOpenModes)[number];

export type TPortalDataCenterEmbed = {
  search: boolean;
  newButton: boolean;
  appSwitcher: boolean;
};

export type TPortalStartupConfig = {
  enabled: boolean;
  brandName: string;
  brandLogoUrl?: string;
  canManage: boolean;
  navigation: {
    assistant: { label: string; path: '/c/new' };
    dataCenter: {
      label: string;
      url: string;
      mode: PortalOpenMode;
      enabled?: boolean;
      embed: TPortalDataCenterEmbed;
    };
    documentCenter: { label: string; url: string; mode: PortalOpenMode; enabled?: boolean };
    appCenter: { label: string; path: '/portal/apps' };
  };
};

export type TPortalSettings = {
  brand: {
    companyLogoUrl?: string;
    portalLogoUrl?: string;
  };
  dataCenter: {
    enabled: boolean;
    label: string;
    url: string;
    embed: TPortalDataCenterEmbed;
  };
  knowledgeCenter: {
    enabled: boolean;
    label: string;
    url: string;
  };
  updatedAt?: string;
  updatedBy?: string;
};

export type UpdatePortalSettingsInput = {
  brand?: {
    companyLogoUrl?: string;
    portalLogoUrl?: string;
  };
  dataCenter?: Partial<Omit<TPortalSettings['dataCenter'], 'embed'>> & {
    embed?: Partial<TPortalDataCenterEmbed>;
  };
  knowledgeCenter?: Partial<TPortalSettings['knowledgeCenter']>;
};

export type TPortalGroup = {
  id: string;
  name: string;
  iconRef: PortalPresetIcon;
  sortOrder: number;
  enabled: boolean;
};

export type TPortalApp = {
  id: string;
  groupId: string;
  name: string;
  description: string;
  iconType: PortalIconType;
  iconRef: string;
  iconUrl?: string;
  sortOrder: number;
  enabled: boolean;
};

export type TPortalCatalog = {
  groups: TPortalGroup[];
  apps: TPortalApp[];
  favoriteAppIds: string[];
};

export type TPortalAdminGroup = TPortalGroup & {
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type TPortalAdminApp = TPortalApp & {
  url: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type TPortalAdminCatalog = {
  groups: TPortalAdminGroup[];
  apps: TPortalAdminApp[];
};

export type TPortalLaunchResponse = {
  url: string;
  mode: PortalOpenMode;
};

export const portalGroupInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  iconRef: z.enum(portalPresetIcons).default('app'),
  sortOrder: z.coerce.number().int().min(0).max(999999).default(0),
  enabled: z.coerce.boolean().default(true),
});

export const portalAppInputSchema = z.object({
  groupId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).default(''),
  url: z.string().trim().min(1).max(2048),
  iconType: z.enum(portalIconTypes),
  iconRef: z.string().trim().max(128).default('app'),
  sortOrder: z.coerce.number().int().min(0).max(999999).default(0),
  enabled: z.coerce.boolean().default(true),
});

export const portalGroupPatchSchema = portalGroupInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field is required');

export const portalAppPatchSchema = portalAppInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'At least one field is required');

export type CreatePortalGroupInput = z.infer<typeof portalGroupInputSchema>;
export type UpdatePortalGroupInput = z.infer<typeof portalGroupPatchSchema>;
export type CreatePortalAppInput = z.infer<typeof portalAppInputSchema>;
export type UpdatePortalAppInput = z.infer<typeof portalAppPatchSchema>;
