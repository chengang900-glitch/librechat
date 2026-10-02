import type { TPortalStartupConfig } from 'librechat-data-provider';
import { isEnabled } from '~/utils';

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
  canManage = false,
): TPortalStartupConfig | undefined {
  if (!isEnabled(env.PORTAL_ENABLED)) {
    return undefined;
  }

  const allowHttp = isEnabled(env.PORTAL_ALLOW_HTTP);
  const dataCenterUrl = validatePortalUrl(
    env.PORTAL_DATA_CENTER_URL,
    allowHttp,
    'PORTAL_DATA_CENTER_URL',
  );
  const documentCenterUrl = validatePortalUrl(
    env.PORTAL_DOCUMENT_CENTER_URL,
    allowHttp,
    'PORTAL_DOCUMENT_CENTER_URL',
  );

  return {
    enabled: true,
    brandName: env.APP_TITLE?.trim() || '企业AI中台',
    canManage,
    navigation: {
      assistant: { label: 'AI工作台', path: '/c/new' },
      dataCenter: { label: '数据中心', url: dataCenterUrl, mode: 'new_tab' },
      documentCenter: { label: '知识中心', url: documentCenterUrl, mode: 'new_tab' },
      appCenter: { label: '应用中心', path: '/portal/apps' },
    },
  };
}
