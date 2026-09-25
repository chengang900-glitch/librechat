import { isEnabled } from '~/utils';

export class PortalUrlError extends Error {
  readonly status = 400;
}

export function validatePortalAppUrl(value: string, env: NodeJS.ProcessEnv = process.env): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new PortalUrlError('Application URL is invalid');
  }

  const allowHttp = isEnabled(env.PORTAL_ALLOW_HTTP);
  const allowed = url.protocol === 'https:' || (allowHttp && url.protocol === 'http:');
  if (!allowed || url.username || url.password) {
    throw new PortalUrlError('Application URL must use an allowed HTTP(S) URL without credentials');
  }
  return url.toString();
}
