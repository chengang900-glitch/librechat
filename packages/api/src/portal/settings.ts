import { z } from 'zod';
import { logger } from '@librechat/data-schemas';
import type { TPortalSettings, UpdatePortalSettingsInput } from 'librechat-data-provider';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import type { PortalUpload } from './icons';
import { savePortalBranding } from './icons';

const urlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
    );
  }, 'URL must use HTTP(S) without credentials');

const settingsSchema = z.object({
  brand: z
    .object({
      portalLogoUrl: z.string().trim().max(512).optional(),
      loginLogoUrl: z.string().trim().max(512).optional(),
    })
    .optional(),
  dataCenter: z
    .object({
      enabled: z.coerce.boolean(),
      label: z.string().trim().min(1).max(40),
      url: urlSchema,
      embed: z
        .object({
          search: z.coerce.boolean(),
          newButton: z.coerce.boolean(),
          appSwitcher: z.coerce.boolean(),
        })
        .partial()
        .optional(),
    })
    .optional(),
  knowledgeCenter: z
    .object({
      enabled: z.coerce.boolean(),
      label: z.string().trim().min(1).max(40),
      url: urlSchema,
    })
    .optional(),
});

type SettingsDeps = {
  getPortalSettings: () => Promise<TPortalSettings | null>;
  updatePortalSettings: (
    input: UpdatePortalSettingsInput & { updatedBy: string },
  ) => Promise<TPortalSettings>;
  brandingDir: string;
  allowHttp: boolean;
};

type UploadRequest = ServerRequest & { file?: PortalUpload };

export type PortalSettingsHandlers = {
  get: (req: ServerRequest, res: Response) => Promise<Response>;
  update: (req: ServerRequest, res: Response) => Promise<Response>;
  uploadLogo: (req: UploadRequest, res: Response) => Promise<Response>;
};

const userId = (req: ServerRequest) => req.user?.id ?? req.user?._id?.toString() ?? 'administrator';
const statusOf = (error: unknown) =>
  typeof error === 'object' &&
  error != null &&
  'status' in error &&
  typeof error.status === 'number'
    ? error.status
    : 500;

export function createPortalSettingsHandlers(deps: SettingsDeps): PortalSettingsHandlers {
  const validateConfiguredUrls = (input: UpdatePortalSettingsInput) => {
    for (const service of [input.dataCenter, input.knowledgeCenter]) {
      if (!service?.url) continue;
      const url = new URL(service.url);
      if (url.protocol === 'http:' && !deps.allowHttp) {
        throw Object.assign(
          new Error('Portal addresses must use HTTPS unless HTTP is explicitly enabled'),
          { status: 400 },
        );
      }
    }
  };

  async function get(_req: ServerRequest, res: Response) {
    try {
      return res.status(200).json(await deps.getPortalSettings());
    } catch (error) {
      logger.error('[portalSettings] load failed', error);
      return res.status(statusOf(error)).json({ error: 'Failed to load portal settings' });
    }
  }

  async function update(req: ServerRequest, res: Response) {
    try {
      const parsed = settingsSchema.parse(req.body) as UpdatePortalSettingsInput;
      validateConfiguredUrls(parsed);
      return res
        .status(200)
        .json(await deps.updatePortalSettings({ ...parsed, updatedBy: userId(req) }));
    } catch (error) {
      return res.status(error instanceof z.ZodError ? 400 : statusOf(error)).json({
        error: error instanceof Error ? error.message : 'Failed to update portal settings',
      });
    }
  }

  async function uploadLogo(req: UploadRequest, res: Response) {
    const type = (req.params as { type?: string }).type;
    if (type !== 'portal' && type !== 'login') {
      return res.status(400).json({ error: 'Logo type is invalid' });
    }
    if (!req.file) return res.status(400).json({ error: 'Logo file is required' });
    try {
      const url = await savePortalBranding(req.file, deps.brandingDir, type);
      return res.status(200).json(
        await deps.updatePortalSettings({
          brand: { [type === 'portal' ? 'portalLogoUrl' : 'loginLogoUrl']: url },
          updatedBy: userId(req),
        }),
      );
    } catch (error) {
      return res.status(statusOf(error)).json({
        error: error instanceof Error ? error.message : 'Failed to upload logo',
      });
    }
  }

  return { get, update, uploadLogo };
}
