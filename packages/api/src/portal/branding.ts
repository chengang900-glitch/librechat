import path from 'path';
import { existsSync } from 'fs';
import type { RequestHandler } from 'express';

export function createPortalBrandingHandler({
  brandingDir,
  assetsDir,
}: {
  brandingDir: string;
  assetsDir: string;
}): RequestHandler {
  return (req, res, next) => {
    const logo = req.params.logo;
    if (!['company-logo.webp', 'portal-logo.webp', 'login-logo.webp'].includes(logo)) {
      next();
      return;
    }
    const uploaded = path.join(brandingDir, logo);
    const legacy = path.join(brandingDir, 'login-logo.webp');
    const fallback = path.join(
      assetsDir,
      'portal',
      logo === 'company-logo.webp' ? 'company-logo.png' : 'uhoo-logo.png',
    );
    const selected = existsSync(uploaded)
      ? uploaded
      : logo === 'company-logo.webp' && existsSync(legacy)
        ? legacy
        : fallback;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(selected);
  };
}
