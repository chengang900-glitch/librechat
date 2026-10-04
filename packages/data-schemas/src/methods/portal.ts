import type {
  CreatePortalAppInput,
  CreatePortalGroupInput,
  TPortalAdminApp,
  TPortalAdminCatalog,
  TPortalAdminGroup,
  TPortalApp,
  TPortalCatalog,
  TPortalGroup,
  TPortalSettings,
  UpdatePortalSettingsInput,
  UpdatePortalAppInput,
  UpdatePortalGroupInput,
} from 'librechat-data-provider';
import type { Model, Types } from 'mongoose';
import type { IPortalApp, IPortalFavorite, IPortalGroup } from '~/types';
import type { IPortalSettings } from '~/types/portalSettings';

const MAX_GROUPS = 100;
const MAX_APPS = 500;

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
  getPortalSettings: () => Promise<TPortalSettings | null>;
  updatePortalSettings: (
    input: UpdatePortalSettingsInput & { updatedBy: string },
  ) => Promise<TPortalSettings>;
}

export function createPortalMethods(mongoose: typeof import('mongoose')): PortalMethods {
  const groupModel = () => mongoose.models.PortalGroup as Model<IPortalGroup>;
  const appModel = () => mongoose.models.PortalApp as Model<IPortalApp>;
  const favoriteModel = () => mongoose.models.PortalFavorite as Model<IPortalFavorite>;
  const settingsModel = () => mongoose.models.PortalSettings as Model<IPortalSettings>;
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

  const mapSettings = (settings: IPortalSettings): TPortalSettings => ({
    brand: settings.brand ?? {},
    dataCenter: {
      enabled: settings.dataCenter?.enabled ?? true,
      label: settings.dataCenter?.label ?? '数据中心',
      url: settings.dataCenter?.url ?? '',
      embed: {
        search: settings.dataCenter?.embed?.search ?? false,
        newButton: settings.dataCenter?.embed?.newButton ?? false,
        appSwitcher: settings.dataCenter?.embed?.appSwitcher ?? false,
      },
    },
    knowledgeCenter: settings.knowledgeCenter ?? { enabled: true, label: '知识中心', url: '' },
    updatedAt: settings.updatedAt?.toISOString(),
    updatedBy: settings.updatedBy,
  });

  async function getPortalSettings(): Promise<TPortalSettings | null> {
    const settings = await settingsModel().findOne({ key: 'default' }).lean<IPortalSettings>();
    return settings ? mapSettings(settings) : null;
  }

  async function updatePortalSettings(
    input: UpdatePortalSettingsInput & { updatedBy: string },
  ): Promise<TPortalSettings> {
    const settings = await settingsModel().findOneAndUpdate(
      { key: 'default' },
      { $set: { ...input, key: 'default' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return mapSettings(settings);
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
    getPortalSettings,
    updatePortalSettings,
  };
}
