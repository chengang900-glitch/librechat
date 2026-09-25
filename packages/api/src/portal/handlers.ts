import { logger } from '@librechat/data-schemas';
import type { RecordAuditEntryInput, RecordAuditEntryOptions } from '@librechat/data-schemas';
import type { TPortalAdminApp, TPortalCatalog } from 'librechat-data-provider';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { buildAuditContext } from '~/admin/context';
import { validatePortalAppUrl } from './url';

interface PortalDeps {
  listEnabledPortalCatalog: (userId: string) => Promise<TPortalCatalog>;
  findLaunchablePortalApp: (id: string) => Promise<TPortalAdminApp | null>;
  addPortalFavorite: (userId: string, appId: string) => Promise<void>;
  removePortalFavorite: (userId: string, appId: string) => Promise<void>;
  recordAuditEntry?: (
    input: RecordAuditEntryInput,
    options?: RecordAuditEntryOptions,
  ) => Promise<unknown>;
}

export interface PortalHandlers {
  catalog: (req: ServerRequest, res: Response) => Promise<Response>;
  addFavorite: (req: ServerRequest, res: Response) => Promise<Response>;
  removeFavorite: (req: ServerRequest, res: Response) => Promise<Response>;
  launch: (req: ServerRequest, res: Response) => Promise<Response>;
}

const userId = (req: ServerRequest): string => req.user?.id ?? req.user?._id?.toString() ?? '';
const portalParams = (req: ServerRequest) => req.params as { appId: string };
const userName = (req: ServerRequest): string =>
  req.user?.name || req.user?.username || req.user?.email || 'authenticated-user';
const statusOf = (error: unknown): number =>
  typeof error === 'object' &&
  error != null &&
  'status' in error &&
  typeof error.status === 'number'
    ? error.status
    : 500;

export function createPortalHandlers(deps: PortalDeps): PortalHandlers {
  async function catalog(req: ServerRequest, res: Response) {
    try {
      return res.status(200).json(await deps.listEnabledPortalCatalog(userId(req)));
    } catch (error) {
      logger.error('[portal] catalog failed', error);
      return res.status(statusOf(error)).json({ error: 'Failed to load application catalog' });
    }
  }

  async function addFavorite(req: ServerRequest, res: Response) {
    try {
      await deps.addPortalFavorite(userId(req), portalParams(req).appId);
      return res.status(204).send();
    } catch (error) {
      return res.status(statusOf(error)).json({ error: (error as Error).message });
    }
  }

  async function removeFavorite(req: ServerRequest, res: Response) {
    try {
      await deps.removePortalFavorite(userId(req), portalParams(req).appId);
      return res.status(204).send();
    } catch (error) {
      return res.status(statusOf(error)).json({ error: (error as Error).message });
    }
  }

  async function launch(req: ServerRequest, res: Response) {
    try {
      const app = await deps.findLaunchablePortalApp(portalParams(req).appId);
      if (!app) {
        return res.status(404).json({ error: 'Application not found' });
      }
      const url = validatePortalAppUrl(app.url);
      if (deps.recordAuditEntry) {
        try {
          await deps.recordAuditEntry({
            action: 'portal.app.launch_requested',
            actor: { type: 'user', id: userId(req), name: userName(req) },
            target: { type: 'portal_app', id: app.id, name: app.name },
            metadata: { groupId: app.groupId, openMode: 'new_tab' },
            context: buildAuditContext(req),
          });
        } catch (error) {
          logger.error('[portal] launch audit failed', error);
        }
      }
      return res.status(200).json({ url, mode: 'new_tab' });
    } catch (error) {
      logger.error('[portal] launch failed', error);
      return res.status(statusOf(error)).json({ error: (error as Error).message });
    }
  }

  return { catalog, addFavorite, removeFavorite, launch };
}
