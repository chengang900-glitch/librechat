import { ZodError } from 'zod';
import { logger } from '@librechat/data-schemas';
import {
  portalAppInputSchema,
  portalAppPatchSchema,
  portalGroupInputSchema,
  portalGroupPatchSchema,
  portalPresetIcons,
} from 'librechat-data-provider';
import type {
  CreatePortalAppInput,
  CreatePortalGroupInput,
  TPortalAdminApp,
  TPortalAdminCatalog,
  TPortalAdminGroup,
  UpdatePortalAppInput,
  UpdatePortalGroupInput,
} from 'librechat-data-provider';
import type { RecordAuditEntryInput, RecordAuditEntryOptions } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import type { PortalUpload } from './icons';
import { removePortalIcon, savePortalIcon } from './icons';
import { buildAuditContext } from '~/admin/context';
import { validatePortalAppUrl } from './url';

interface PortalAdminDeps {
  iconDir: string;
  listAdminPortalCatalog: () => Promise<TPortalAdminCatalog>;
  createPortalGroup: (
    input: CreatePortalGroupInput & { updatedBy: string },
  ) => Promise<TPortalAdminGroup>;
  updatePortalGroup: (
    id: string,
    input: UpdatePortalGroupInput & { updatedBy: string },
  ) => Promise<TPortalAdminGroup>;
  deletePortalGroup: (id: string) => Promise<void>;
  createPortalApp: (
    input: CreatePortalAppInput & { updatedBy: string },
  ) => Promise<TPortalAdminApp>;
  updatePortalApp: (
    id: string,
    input: UpdatePortalAppInput & { updatedBy: string },
  ) => Promise<TPortalAdminApp>;
  deletePortalApp: (id: string) => Promise<TPortalAdminApp>;
  recordAuditEntry?: (
    input: RecordAuditEntryInput,
    options?: RecordAuditEntryOptions,
  ) => Promise<unknown>;
}

export interface PortalAdminHandlers {
  catalog: (req: ServerRequest, res: Response) => Promise<Response>;
  createGroup: (req: ServerRequest, res: Response) => Promise<Response>;
  updateGroup: (req: ServerRequest, res: Response) => Promise<Response>;
  deleteGroup: (req: ServerRequest, res: Response) => Promise<Response>;
  createApp: (req: UploadRequest, res: Response) => Promise<Response>;
  updateApp: (req: UploadRequest, res: Response) => Promise<Response>;
  deleteApp: (req: ServerRequest, res: Response) => Promise<Response>;
}

type UploadRequest = ServerRequest & { file?: PortalUpload };
const portalParams = (req: ServerRequest) => req.params as { groupId: string; appId: string };

const getUserId = (req: ServerRequest): string => req.user?.id ?? req.user?._id?.toString() ?? '';
const getUserName = (req: ServerRequest): string =>
  req.user?.name || req.user?.username || req.user?.email || 'administrator';
const statusOf = (error: unknown): number => {
  if (error instanceof ZodError) {
    return 400;
  }
  if (
    typeof error === 'object' &&
    error != null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status;
  }
  return 500;
};
const errorBody = (error: unknown) => ({
  error: error instanceof Error ? error.message : 'Portal operation failed',
});
const badRequest = (message: string): Error & { status: number } =>
  Object.assign(new Error(message), { status: 400 });

function parseMultipartPayload(req: UploadRequest): unknown {
  const payload = (req.body as { payload?: unknown })?.payload;
  if (typeof payload !== 'string') {
    return req.body;
  }
  try {
    return JSON.parse(payload);
  } catch {
    throw badRequest('payload must be valid JSON');
  }
}

export function createPortalAdminHandlers(deps: PortalAdminDeps): PortalAdminHandlers {
  async function audit(
    req: ServerRequest,
    action: RecordAuditEntryInput['action'],
    target: RecordAuditEntryInput['target'],
    metadata?: RecordAuditEntryInput['metadata'],
  ) {
    if (!deps.recordAuditEntry) return;
    try {
      await deps.recordAuditEntry({
        action,
        actor: { type: 'user', id: getUserId(req), name: getUserName(req) },
        target,
        metadata,
        context: buildAuditContext(req),
      });
    } catch (error) {
      logger.error(`[portalAdmin] ${action} audit failed`, error);
    }
  }

  async function catalog(_req: ServerRequest, res: Response) {
    try {
      return res.status(200).json(await deps.listAdminPortalCatalog());
    } catch (error) {
      logger.error('[portalAdmin] catalog failed', error);
      return res.status(500).json({ error: 'Failed to load portal administration data' });
    }
  }

  async function createGroup(req: ServerRequest, res: Response) {
    try {
      const input = portalGroupInputSchema.parse(req.body);
      const group = await deps.createPortalGroup({ ...input, updatedBy: getUserId(req) });
      await audit(req, 'portal.group.created', {
        type: 'portal_group',
        id: group.id,
        name: group.name,
      });
      return res.status(201).json(group);
    } catch (error) {
      return res.status(statusOf(error)).json(errorBody(error));
    }
  }

  async function updateGroup(req: ServerRequest, res: Response) {
    try {
      const input = portalGroupPatchSchema.parse(req.body);
      const group = await deps.updatePortalGroup(portalParams(req).groupId, {
        ...input,
        updatedBy: getUserId(req),
      });
      await audit(
        req,
        'portal.group.updated',
        { type: 'portal_group', id: group.id, name: group.name },
        { changedFields: Object.keys(input).sort().join(',') },
      );
      return res.status(200).json(group);
    } catch (error) {
      return res.status(statusOf(error)).json(errorBody(error));
    }
  }

  async function deleteGroup(req: ServerRequest, res: Response) {
    try {
      const existing = (await deps.listAdminPortalCatalog()).groups.find(
        (group) => group.id === portalParams(req).groupId,
      );
      await deps.deletePortalGroup(portalParams(req).groupId);
      await audit(req, 'portal.group.deleted', {
        type: 'portal_group',
        id: portalParams(req).groupId,
        name: existing?.name,
      });
      return res.status(204).send();
    } catch (error) {
      return res.status(statusOf(error)).json(errorBody(error));
    }
  }

  async function createApp(req: UploadRequest, res: Response) {
    let newIconRef: string | undefined;
    try {
      const raw = parseMultipartPayload(req) as CreatePortalAppInput;
      const candidate = { ...raw };
      if (req.file) {
        newIconRef = await savePortalIcon(req.file, deps.iconDir);
        candidate.iconType = 'upload';
        candidate.iconRef = newIconRef;
      }
      const input = portalAppInputSchema.parse(candidate);
      if (input.iconType === 'upload' && !newIconRef) {
        throw badRequest('An uploaded icon file is required');
      }
      if (input.iconType === 'preset' && !portalPresetIcons.includes(input.iconRef as never)) {
        throw badRequest('Preset icon is invalid');
      }
      const app = await deps.createPortalApp({
        ...input,
        url: validatePortalAppUrl(input.url),
        updatedBy: getUserId(req),
      });
      await audit(
        req,
        'portal.app.created',
        { type: 'portal_app', id: app.id, name: app.name },
        { groupId: app.groupId, iconType: app.iconType },
      );
      return res.status(201).json(app);
    } catch (error) {
      if (newIconRef) {
        await removePortalIcon(newIconRef, deps.iconDir).catch((cleanupError) =>
          logger.error('[portalAdmin] failed to clean new icon', cleanupError),
        );
      }
      return res.status(statusOf(error)).json(errorBody(error));
    }
  }

  async function updateApp(req: UploadRequest, res: Response) {
    let newIconRef: string | undefined;
    try {
      const existing = (await deps.listAdminPortalCatalog()).apps.find(
        (app) => app.id === portalParams(req).appId,
      );
      if (!existing) {
        return res.status(404).json({ error: 'Application not found' });
      }
      const raw = parseMultipartPayload(req) as UpdatePortalAppInput;
      const candidate = { ...raw };
      if (req.file) {
        newIconRef = await savePortalIcon(req.file, deps.iconDir);
        candidate.iconType = 'upload';
        candidate.iconRef = newIconRef;
      } else if (candidate.iconType === 'upload') {
        candidate.iconRef = existing.iconRef;
      }
      const input = portalAppPatchSchema.parse(candidate);
      if (
        input.iconType === 'preset' &&
        input.iconRef &&
        !portalPresetIcons.includes(input.iconRef as never)
      ) {
        throw badRequest('Preset icon is invalid');
      }
      const app = await deps.updatePortalApp(portalParams(req).appId, {
        ...input,
        ...(input.url ? { url: validatePortalAppUrl(input.url) } : {}),
        updatedBy: getUserId(req),
      });
      if (newIconRef && existing.iconType === 'upload') {
        await removePortalIcon(existing.iconRef, deps.iconDir);
      }
      await audit(
        req,
        'portal.app.updated',
        { type: 'portal_app', id: app.id, name: app.name },
        { changedFields: Object.keys(input).sort().join(','), groupId: app.groupId },
      );
      return res.status(200).json(app);
    } catch (error) {
      if (newIconRef) {
        await removePortalIcon(newIconRef, deps.iconDir).catch((cleanupError) =>
          logger.error('[portalAdmin] failed to clean replacement icon', cleanupError),
        );
      }
      return res.status(statusOf(error)).json(errorBody(error));
    }
  }

  async function deleteApp(req: ServerRequest, res: Response) {
    try {
      const app = await deps.deletePortalApp(portalParams(req).appId);
      if (app.iconType === 'upload') {
        await removePortalIcon(app.iconRef, deps.iconDir).catch((error) =>
          logger.error('[portalAdmin] failed to remove deleted app icon', error),
        );
      }
      await audit(
        req,
        'portal.app.deleted',
        { type: 'portal_app', id: app.id, name: app.name },
        {
          groupId: app.groupId,
        },
      );
      return res.status(204).send();
    } catch (error) {
      return res.status(statusOf(error)).json(errorBody(error));
    }
  }

  return { catalog, createGroup, updateGroup, deleteGroup, createApp, updateApp, deleteApp };
}
