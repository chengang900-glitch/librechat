import type {
  CreatePortalAppInput,
  CreatePortalGroupInput,
  TPortalAdminApp,
  TPortalAdminCatalog,
  TPortalAdminGroup,
  TPortalApp,
  TPortalCatalog,
  TPortalGroup,
  UpdatePortalAppInput,
  UpdatePortalGroupInput,
} from 'librechat-data-provider';
import type { Model, Types } from 'mongoose';
import type {
  IPortalApp,
  IPortalFavorite,
  IPortalGroup,
  IPortalKnowledgeFavorite,
  IPortalKnowledgeRecent,
  IPortalKnowledgeSession,
  PortalKnowledgeTargetType,
} from '~/types';

const MAX_GROUPS = 100;
const MAX_APPS = 500;
const MAX_KNOWLEDGE_RECENTS = 50;

export class PortalDataError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const nameKey = (name: string) => name.trim().toLocaleLowerCase('zh-CN');
const iconUrl = (app: Pick<IPortalApp, 'iconType' | 'iconRef'>) =>
  app.iconType === 'upload' ? `/images/portal/${encodeURIComponent(app.iconRef)}` : undefined;

type PortalGroupFields = Pick<IPortalGroup, '_id' | 'name' | 'iconRef' | 'sortOrder' | 'enabled'>;
type PortalAppFields = Pick<
  IPortalApp,
  '_id' | 'groupId' | 'name' | 'description' | 'iconType' | 'iconRef' | 'sortOrder' | 'enabled'
>;

const mapGroup = (group: PortalGroupFields): TPortalGroup => ({
  id: group._id.toString(),
  name: group.name,
  iconRef: group.iconRef ?? 'app',
  sortOrder: group.sortOrder,
  enabled: group.enabled,
});

const mapAdminGroup = (
  group: PortalGroupFields & Pick<IPortalGroup, 'createdAt' | 'updatedAt' | 'updatedBy'>,
): TPortalAdminGroup => ({
  ...mapGroup(group),
  createdAt: group.createdAt.toISOString(),
  updatedAt: group.updatedAt.toISOString(),
  updatedBy: group.updatedBy,
});

const mapApp = (app: PortalAppFields): TPortalApp => ({
  id: app._id.toString(),
  groupId: app.groupId.toString(),
  name: app.name,
  description: app.description,
  iconType: app.iconType,
  iconRef: app.iconRef,
  ...(iconUrl(app) ? { iconUrl: iconUrl(app) } : {}),
  sortOrder: app.sortOrder,
  enabled: app.enabled,
});

const mapAdminApp = (
  app: PortalAppFields & Pick<IPortalApp, 'url' | 'createdAt' | 'updatedAt' | 'updatedBy'>,
): TPortalAdminApp => ({
  ...mapApp(app),
  url: app.url,
  createdAt: app.createdAt.toISOString(),
  updatedAt: app.updatedAt.toISOString(),
  updatedBy: app.updatedBy,
});

export interface PortalMethods {
  listEnabledPortalCatalog: (userId: string) => Promise<TPortalCatalog>;
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
  findLaunchablePortalApp: (id: string) => Promise<TPortalAdminApp | null>;
  addPortalFavorite: (userId: string, appId: string) => Promise<void>;
  removePortalFavorite: (userId: string, appId: string) => Promise<void>;
  listPortalKnowledgeFavorites: (
    userId: string,
    knowledgeBaseId: string,
  ) => Promise<PortalKnowledgeFavoriteRecord[]>;
  addPortalKnowledgeFavorite: (input: PortalKnowledgeFavoriteInput) => Promise<void>;
  removePortalKnowledgeFavorite: (
    userId: string,
    knowledgeBaseId: string,
    targetType: PortalKnowledgeTargetType,
    targetId: string,
  ) => Promise<void>;
  recordPortalKnowledgeRecent: (input: PortalKnowledgeRecentInput) => Promise<void>;
  listPortalKnowledgeRecents: (
    userId: string,
    knowledgeBaseId: string,
  ) => Promise<PortalKnowledgeRecentRecord[]>;
  createPortalKnowledgeSession: (
    input: PortalKnowledgeSessionInput,
  ) => Promise<PortalKnowledgeSessionRecord>;
  getPortalKnowledgeSession: (
    userId: string,
    knowledgeBaseId: string,
    portalSessionId: string,
  ) => Promise<PortalKnowledgeSessionRecord | null>;
  touchPortalKnowledgeSession: (
    userId: string,
    knowledgeBaseId: string,
    portalSessionId: string,
  ) => Promise<void>;
  deletePortalKnowledgeSession: (
    userId: string,
    knowledgeBaseId: string,
    portalSessionId: string,
  ) => Promise<void>;
}

export interface PortalKnowledgeFavoriteInput {
  userId: string;
  targetType: PortalKnowledgeTargetType;
  targetId: string;
  knowledgeBaseId: string;
  titleSnapshot?: string;
}

export interface PortalKnowledgeRecentInput {
  userId: string;
  targetType: PortalKnowledgeTargetType;
  targetId: string;
  knowledgeBaseId: string;
  titleSnapshot?: string;
}

export interface PortalKnowledgeFavoriteRecord {
  targetType: PortalKnowledgeTargetType;
  targetId: string;
  knowledgeBaseId: string;
  titleSnapshot: string;
  createdAt: string;
}

export interface PortalKnowledgeRecentRecord {
  targetType: PortalKnowledgeTargetType;
  targetId: string;
  knowledgeBaseId: string;
  titleSnapshot: string;
  lastUsedAt: string;
}

export interface PortalKnowledgeSessionInput {
  userId: string;
  portalSessionId: string;
  providerSessionId: string;
  knowledgeBaseId: string;
}

export interface PortalKnowledgeSessionRecord {
  portalSessionId: string;
  providerSessionId: string;
  knowledgeBaseId: string;
  lastUsedAt: string;
  createdAt: string;
}

export function createPortalMethods(mongoose: typeof import('mongoose')): PortalMethods {
  const groupModel = () => mongoose.models.PortalGroup as Model<IPortalGroup>;
  const appModel = () => mongoose.models.PortalApp as Model<IPortalApp>;
  const favoriteModel = () => mongoose.models.PortalFavorite as Model<IPortalFavorite>;
  const knowledgeFavoriteModel = () =>
    mongoose.models.PortalKnowledgeFavorite as Model<IPortalKnowledgeFavorite>;
  const knowledgeRecentModel = () =>
    mongoose.models.PortalKnowledgeRecent as Model<IPortalKnowledgeRecent>;
  const knowledgeSessionModel = () =>
    mongoose.models.PortalKnowledgeSession as Model<IPortalKnowledgeSession>;
  const objectId = (value: string, field: string): Types.ObjectId => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new PortalDataError('PORTAL_INVALID_ID', 400, `${field} is invalid`);
    }
    return new mongoose.Types.ObjectId(value);
  };
  const translateError = (error: unknown): never => {
    if (error instanceof PortalDataError) {
      throw error;
    }
    if (typeof error === 'object' && error != null && 'code' in error && error.code === 11000) {
      throw new PortalDataError('PORTAL_DUPLICATE_NAME', 409, 'Name already exists');
    }
    throw error;
  };

  async function listEnabledPortalCatalog(userId: string): Promise<TPortalCatalog> {
    const userObjectId = objectId(userId, 'userId');
    const groups = await groupModel()
      .find({ enabled: true })
      .sort({ sortOrder: 1, nameKey: 1 })
      .lean();
    const groupIds = groups.map((group) => group._id);
    const apps = await appModel()
      .find({ enabled: true, groupId: { $in: groupIds } })
      .sort({ sortOrder: 1, nameKey: 1 })
      .lean();
    const appIds = apps.map((app) => app._id);
    const favorites = await favoriteModel()
      .find({ userId: userObjectId, appId: { $in: appIds } })
      .lean();
    return {
      groups: groups.map(mapGroup),
      apps: apps.map(mapApp),
      favoriteAppIds: favorites.map((favorite) => favorite.appId.toString()),
    };
  }

  async function listAdminPortalCatalog(): Promise<TPortalAdminCatalog> {
    const [groups, apps] = await Promise.all([
      groupModel().find({}).sort({ sortOrder: 1, nameKey: 1 }).lean(),
      appModel().find({}).sort({ sortOrder: 1, nameKey: 1 }).lean(),
    ]);
    return {
      groups: groups.map(mapAdminGroup),
      apps: apps.map(mapAdminApp),
    };
  }

  async function createPortalGroup(
    input: CreatePortalGroupInput & { updatedBy: string },
  ): Promise<TPortalAdminGroup> {
    if ((await groupModel().countDocuments()) >= MAX_GROUPS) {
      throw new PortalDataError('PORTAL_GROUP_LIMIT', 409, 'Portal group limit reached');
    }
    try {
      const group = await groupModel().create({ ...input, nameKey: nameKey(input.name) });
      return mapAdminGroup(group);
    } catch (error) {
      return translateError(error);
    }
  }

  async function updatePortalGroup(
    id: string,
    input: UpdatePortalGroupInput & { updatedBy: string },
  ): Promise<TPortalAdminGroup> {
    const _id = objectId(id, 'groupId');
    const update = { ...input, ...(input.name ? { nameKey: nameKey(input.name) } : {}) };
    try {
      const group = await groupModel().findByIdAndUpdate(_id, update, {
        new: true,
        runValidators: true,
      });
      if (!group) {
        throw new PortalDataError('PORTAL_GROUP_NOT_FOUND', 404, 'Portal group not found');
      }
      return mapAdminGroup(group);
    } catch (error) {
      return translateError(error);
    }
  }

  async function deletePortalGroup(id: string): Promise<void> {
    const _id = objectId(id, 'groupId');
    if ((await appModel().countDocuments({ groupId: _id })) > 0) {
      throw new PortalDataError('PORTAL_GROUP_NOT_EMPTY', 409, 'Portal group is not empty');
    }
    const result = await groupModel().deleteOne({ _id });
    if (!result.deletedCount) {
      throw new PortalDataError('PORTAL_GROUP_NOT_FOUND', 404, 'Portal group not found');
    }
  }

  async function requireGroup(groupId: string): Promise<Types.ObjectId> {
    const _id = objectId(groupId, 'groupId');
    if (!(await groupModel().exists({ _id }))) {
      throw new PortalDataError('PORTAL_GROUP_NOT_FOUND', 400, 'Portal group not found');
    }
    return _id;
  }

  async function createPortalApp(
    input: CreatePortalAppInput & { updatedBy: string },
  ): Promise<TPortalAdminApp> {
    if ((await appModel().countDocuments()) >= MAX_APPS) {
      throw new PortalDataError('PORTAL_APP_LIMIT', 409, 'Portal app limit reached');
    }
    const groupId = await requireGroup(input.groupId);
    try {
      const app = await appModel().create({
        ...input,
        groupId,
        nameKey: nameKey(input.name),
      });
      return mapAdminApp(app);
    } catch (error) {
      return translateError(error);
    }
  }

  async function updatePortalApp(
    id: string,
    input: UpdatePortalAppInput & { updatedBy: string },
  ): Promise<TPortalAdminApp> {
    const _id = objectId(id, 'appId');
    const groupId = input.groupId ? await requireGroup(input.groupId) : undefined;
    const update = {
      ...input,
      ...(groupId ? { groupId } : {}),
      ...(input.name ? { nameKey: nameKey(input.name) } : {}),
    };
    try {
      const app = await appModel().findByIdAndUpdate(_id, update, {
        new: true,
        runValidators: true,
      });
      if (!app) {
        throw new PortalDataError('PORTAL_APP_NOT_FOUND', 404, 'Portal app not found');
      }
      return mapAdminApp(app);
    } catch (error) {
      return translateError(error);
    }
  }

  async function deletePortalApp(id: string): Promise<TPortalAdminApp> {
    const _id = objectId(id, 'appId');
    const app = await appModel().findByIdAndDelete(_id);
    if (!app) {
      throw new PortalDataError('PORTAL_APP_NOT_FOUND', 404, 'Portal app not found');
    }
    await favoriteModel().deleteMany({ appId: _id });
    return mapAdminApp(app);
  }

  async function findLaunchablePortalApp(id: string): Promise<TPortalAdminApp | null> {
    const _id = objectId(id, 'appId');
    const app = await appModel().findOne({ _id, enabled: true });
    if (!app) {
      return null;
    }
    const groupEnabled = await groupModel().exists({ _id: app.groupId, enabled: true });
    return groupEnabled ? mapAdminApp(app) : null;
  }

  async function addPortalFavorite(userId: string, appId: string): Promise<void> {
    const userObjectId = objectId(userId, 'userId');
    const app = await findLaunchablePortalApp(appId);
    if (!app) {
      throw new PortalDataError('PORTAL_APP_NOT_FOUND', 404, 'Portal app not found');
    }
    await favoriteModel().updateOne(
      { userId: userObjectId, appId: objectId(appId, 'appId') },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
  }

  async function removePortalFavorite(userId: string, appId: string): Promise<void> {
    await favoriteModel().deleteOne({
      userId: objectId(userId, 'userId'),
      appId: objectId(appId, 'appId'),
    });
  }

  const knowledgeTarget = (targetType: PortalKnowledgeTargetType, targetId: string) => {
    if (!['knowledge_base', 'document'].includes(targetType)) {
      throw new PortalDataError('PORTAL_KNOWLEDGE_TARGET_TYPE', 400, 'Invalid knowledge target');
    }
    const normalizedId = targetId.trim();
    if (!normalizedId || normalizedId.length > 200) {
      throw new PortalDataError('PORTAL_KNOWLEDGE_TARGET_ID', 400, 'Invalid knowledge target id');
    }
    return normalizedId;
  };

  const knowledgeSessionId = (value: string, field: string) => {
    const normalized = value.trim();
    if (!normalized || normalized.length > 200) {
      throw new PortalDataError('PORTAL_KNOWLEDGE_SESSION_ID', 400, `${field} is invalid`);
    }
    return normalized;
  };

  const mapKnowledgeFavorite = (
    item: Pick<
      IPortalKnowledgeFavorite,
      'targetType' | 'targetId' | 'knowledgeBaseId' | 'titleSnapshot' | 'createdAt'
    >,
  ): PortalKnowledgeFavoriteRecord => ({
    targetType: item.targetType,
    targetId: item.targetId,
    knowledgeBaseId: item.knowledgeBaseId,
    titleSnapshot: item.titleSnapshot,
    createdAt: item.createdAt.toISOString(),
  });

  const mapKnowledgeRecent = (
    item: Pick<
      IPortalKnowledgeRecent,
      'targetType' | 'targetId' | 'knowledgeBaseId' | 'titleSnapshot' | 'lastUsedAt'
    >,
  ): PortalKnowledgeRecentRecord => ({
    targetType: item.targetType,
    targetId: item.targetId,
    knowledgeBaseId: item.knowledgeBaseId,
    titleSnapshot: item.titleSnapshot,
    lastUsedAt: item.lastUsedAt.toISOString(),
  });

  const mapKnowledgeSession = (
    item: Pick<
      IPortalKnowledgeSession,
      'portalSessionId' | 'providerSessionId' | 'knowledgeBaseId' | 'lastUsedAt' | 'createdAt'
    >,
  ): PortalKnowledgeSessionRecord => ({
    portalSessionId: item.portalSessionId,
    providerSessionId: item.providerSessionId,
    knowledgeBaseId: item.knowledgeBaseId,
    lastUsedAt: item.lastUsedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
  });

  async function listPortalKnowledgeFavorites(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<PortalKnowledgeFavoriteRecord[]> {
    const userObjectId = objectId(userId, 'userId');
    return (
      await knowledgeFavoriteModel()
        .find({ userId: userObjectId, knowledgeBaseId })
        .sort({ createdAt: -1 })
        .lean()
    ).map(mapKnowledgeFavorite);
  }

  async function addPortalKnowledgeFavorite(input: PortalKnowledgeFavoriteInput): Promise<void> {
    const userObjectId = objectId(input.userId, 'userId');
    const targetId = knowledgeTarget(input.targetType, input.targetId);
    const knowledgeBaseId = input.knowledgeBaseId.trim();
    if (!knowledgeBaseId || knowledgeBaseId.length > 200) {
      throw new PortalDataError('PORTAL_KNOWLEDGE_BASE_ID', 400, 'Invalid knowledge base id');
    }
    try {
      await knowledgeFavoriteModel().updateOne(
        { userId: userObjectId, targetType: input.targetType, targetId },
        {
          $setOnInsert: {
            userId: userObjectId,
            targetType: input.targetType,
            targetId,
            knowledgeBaseId,
            titleSnapshot: String(input.titleSnapshot || '').slice(0, 512),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      return translateError(error);
    }
  }

  async function removePortalKnowledgeFavorite(
    userId: string,
    knowledgeBaseId: string,
    targetType: PortalKnowledgeTargetType,
    targetId: string,
  ): Promise<void> {
    const userObjectId = objectId(userId, 'userId');
    await knowledgeFavoriteModel().deleteOne({
      userId: userObjectId,
      knowledgeBaseId,
      targetType,
      targetId: knowledgeTarget(targetType, targetId),
    });
  }

  async function recordPortalKnowledgeRecent(input: PortalKnowledgeRecentInput): Promise<void> {
    const userObjectId = objectId(input.userId, 'userId');
    const targetId = knowledgeTarget(input.targetType, input.targetId);
    const knowledgeBaseId = input.knowledgeBaseId.trim();
    if (!knowledgeBaseId || knowledgeBaseId.length > 200) {
      throw new PortalDataError('PORTAL_KNOWLEDGE_BASE_ID', 400, 'Invalid knowledge base id');
    }
    await knowledgeRecentModel().updateOne(
      { userId: userObjectId, targetType: input.targetType, targetId },
      {
        $set: {
          knowledgeBaseId,
          titleSnapshot: String(input.titleSnapshot || '').slice(0, 512),
          lastUsedAt: new Date(),
        },
        $setOnInsert: { userId: userObjectId, targetType: input.targetType, targetId },
      },
      { upsert: true },
    );
    const stale = await knowledgeRecentModel()
      .find({ userId: userObjectId, knowledgeBaseId })
      .sort({ lastUsedAt: -1 })
      .skip(MAX_KNOWLEDGE_RECENTS)
      .select({ _id: 1 })
      .lean();
    if (stale.length > 0) {
      await knowledgeRecentModel().deleteMany({ _id: { $in: stale.map((item) => item._id) } });
    }
  }

  async function listPortalKnowledgeRecents(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<PortalKnowledgeRecentRecord[]> {
    const userObjectId = objectId(userId, 'userId');
    return (
      await knowledgeRecentModel()
        .find({ userId: userObjectId, knowledgeBaseId })
        .sort({ lastUsedAt: -1 })
        .limit(MAX_KNOWLEDGE_RECENTS)
        .lean()
    ).map(mapKnowledgeRecent);
  }

  async function createPortalKnowledgeSession(
    input: PortalKnowledgeSessionInput,
  ): Promise<PortalKnowledgeSessionRecord> {
    const userId = objectId(input.userId, 'userId');
    const knowledgeBaseId = knowledgeSessionId(input.knowledgeBaseId, 'knowledgeBaseId');
    const portalSessionId = knowledgeSessionId(input.portalSessionId, 'portalSessionId');
    const providerSessionId = knowledgeSessionId(input.providerSessionId, 'providerSessionId');
    try {
      const session = await knowledgeSessionModel().create({
        userId,
        knowledgeBaseId,
        portalSessionId,
        providerSessionId,
        lastUsedAt: new Date(),
      });
      return mapKnowledgeSession(session);
    } catch (error) {
      return translateError(error);
    }
  }

  async function getPortalKnowledgeSession(
    userId: string,
    knowledgeBaseId: string,
    portalSessionId: string,
  ): Promise<PortalKnowledgeSessionRecord | null> {
    const session = await knowledgeSessionModel()
      .findOne({
        userId: objectId(userId, 'userId'),
        knowledgeBaseId: knowledgeSessionId(knowledgeBaseId, 'knowledgeBaseId'),
        portalSessionId: knowledgeSessionId(portalSessionId, 'portalSessionId'),
      })
      .lean();
    return session ? mapKnowledgeSession(session) : null;
  }

  async function touchPortalKnowledgeSession(
    userId: string,
    knowledgeBaseId: string,
    portalSessionId: string,
  ): Promise<void> {
    await knowledgeSessionModel().updateOne(
      {
        userId: objectId(userId, 'userId'),
        knowledgeBaseId: knowledgeSessionId(knowledgeBaseId, 'knowledgeBaseId'),
        portalSessionId: knowledgeSessionId(portalSessionId, 'portalSessionId'),
      },
      { $set: { lastUsedAt: new Date() } },
    );
  }

  async function deletePortalKnowledgeSession(
    userId: string,
    knowledgeBaseId: string,
    portalSessionId: string,
  ): Promise<void> {
    await knowledgeSessionModel().deleteOne({
      userId: objectId(userId, 'userId'),
      knowledgeBaseId: knowledgeSessionId(knowledgeBaseId, 'knowledgeBaseId'),
      portalSessionId: knowledgeSessionId(portalSessionId, 'portalSessionId'),
    });
  }

  return {
    listEnabledPortalCatalog,
    listAdminPortalCatalog,
    createPortalGroup,
    updatePortalGroup,
    deletePortalGroup,
    createPortalApp,
    updatePortalApp,
    deletePortalApp,
    findLaunchablePortalApp,
    addPortalFavorite,
    removePortalFavorite,
    listPortalKnowledgeFavorites,
    addPortalKnowledgeFavorite,
    removePortalKnowledgeFavorite,
    recordPortalKnowledgeRecent,
    listPortalKnowledgeRecents,
    createPortalKnowledgeSession,
    getPortalKnowledgeSession,
    touchPortalKnowledgeSession,
    deletePortalKnowledgeSession,
  };
}
