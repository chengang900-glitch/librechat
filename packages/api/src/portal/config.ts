import { SystemRoles } from 'librechat-data-provider';
import type { TPortalSettings, TPortalStartupConfig } from 'librechat-data-provider';
import { isEnabled } from '~/utils';

const defaultDataCenterEmbed = {
  search: false,
  newButton: false,
  appSwitcher: false,
} as const;

const validatePortalUrl = (
  value: string | undefined,
  allowHttp: boolean,
  label: string,
): string => {
  if (!value?.trim()) {
    throw new Error(`[portal] ${label} is required when PORTAL_ENABLED=true`);
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`[portal] ${label} must be a valid URL`);
  }

  const allowedProtocol = url.protocol === 'https:' || (allowHttp && url.protocol === 'http:');
  if (!allowedProtocol || url.username || url.password) {
    throw new Error(`[portal] ${label} must use an allowed HTTP(S) URL without credentials`);
  }

  return url.toString();
};

export function buildPortalStartupConfig(
  env: NodeJS.ProcessEnv = process.env,
  role?: string,
  settings?: TPortalSettings | null,
): TPortalStartupConfig | undefined {
  if (!isEnabled(env.PORTAL_ENABLED)) {
    return undefined;
  }

  const allowHttp = isEnabled(env.PORTAL_ALLOW_HTTP);
  const dataCenterUrl = validatePortalUrl(
    settings?.dataCenter?.url || env.PORTAL_DATA_CENTER_URL,
    allowHttp,
    'PORTAL_DATA_CENTER_URL',
  );
  const documentCenterUrl = validatePortalUrl(
    settings?.knowledgeCenter?.url || env.PORTAL_DOCUMENT_CENTER_URL,
    allowHttp,
    'PORTAL_DOCUMENT_CENTER_URL',
  );

  return {
    enabled: true,
    brandName: env.APP_TITLE?.trim() || '企业AI中台',
    ...(settings?.brand?.portalLogoUrl ? { brandLogoUrl: settings.brand.portalLogoUrl } : {}),
    canManage: role === SystemRoles.ADMIN,
    navigation: {
      assistant: { label: 'AI工作台', path: '/c/new' },
      dataCenter: {
        label: settings?.dataCenter?.label || '数据中心',
        url: dataCenterUrl,
        mode: 'new_tab',
        embed: { ...defaultDataCenterEmbed, ...settings?.dataCenter?.embed },
        ...(settings ? { enabled: settings.dataCenter.enabled } : {}),
      },
      documentCenter: {
        label: settings?.knowledgeCenter?.label || '知识中心',
        url: documentCenterUrl,
        mode: 'new_tab',
        ...(settings ? { enabled: settings.knowledgeCenter.enabled } : {}),
      },
      appCenter: { label: '应用中心', path: '/portal/apps' },
    },
  };
}
