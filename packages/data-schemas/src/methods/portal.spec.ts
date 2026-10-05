import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { IPortalApp, IPortalFavorite, IPortalGroup } from '~/types';
import type { IPortalSettings } from '~/types/portalSettings';
import portalFavoriteSchema from '~/schema/portal/favorite';
import portalGroupSchema from '~/schema/portal/group';
import portalAppSchema from '~/schema/portal/app';
import portalSettingsSchema from '~/schema/portal/settings';
import { createPortalMethods } from './portal';

jest.setTimeout(60_000);

let mongoServer: MongoMemoryServer | undefined;
let methods: ReturnType<typeof createPortalMethods>;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  if (!mongoose.models.PortalGroup) {
    mongoose.model<IPortalGroup>('PortalGroup', portalGroupSchema);
  }
  if (!mongoose.models.PortalApp) {
    mongoose.model<IPortalApp>('PortalApp', portalAppSchema);
  }
  if (!mongoose.models.PortalFavorite) {
    mongoose.model<IPortalFavorite>('PortalFavorite', portalFavoriteSchema);
  }
  if (!mongoose.models.PortalSettings) {
    mongoose.model<IPortalSettings>('PortalSettings', portalSettingsSchema);
  }
  methods = createPortalMethods(mongoose);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

beforeEach(async () => {
  await Promise.all([
    mongoose.models.PortalGroup.deleteMany({}),
    mongoose.models.PortalApp.deleteMany({}),
    mongoose.models.PortalFavorite.deleteMany({}),
    mongoose.models.PortalSettings.deleteMany({}),
  ]);
});

async function createGroup(name = '业务系统') {
  return methods.createPortalGroup({
    name,
    iconRef: 'dashboard',
    sortOrder: 10,
    enabled: true,
    updatedBy: 'admin',
  });
}

async function createApp(groupId: string, name = '经营分析') {
  return methods.createPortalApp({
    groupId,
    name,
    description: '企业经营数据分析',
    url: 'https://apps.example.com/',
    iconType: 'preset',
    iconRef: 'chart',
    sortOrder: 10,
    enabled: true,
    updatedBy: 'admin',
  });
}

describe('portal data methods', () => {
  it('creates groups and apps and returns only enabled catalog entries', async () => {
    const enabled = await createGroup();
    const disabled = await createGroup('停用分组');
    await methods.updatePortalGroup(disabled.id, { enabled: false, updatedBy: 'admin' });
    const app = await createApp(enabled.id);
    await createApp(disabled.id, '不可见应用');

    const catalog = await methods.listEnabledPortalCatalog(new Types.ObjectId().toString());

    expect(catalog.groups.map((group) => group.id)).toEqual([enabled.id]);
    expect(catalog.groups[0].iconRef).toBe('dashboard');
    expect(catalog.apps.map((value) => value.id)).toEqual([app.id]);
    expect(catalog.apps[0]).not.toHaveProperty('url');
  });

  it('supports idempotent per-user favorites', async () => {
    const group = await createGroup();
    const app = await createApp(group.id);
    const userId = new Types.ObjectId().toString();

    await methods.addPortalFavorite(userId, app.id);
    await methods.addPortalFavorite(userId, app.id);
    expect((await methods.listEnabledPortalCatalog(userId)).favoriteAppIds).toEqual([app.id]);

    await methods.removePortalFavorite(userId, app.id);
    expect((await methods.listEnabledPortalCatalog(userId)).favoriteAppIds).toEqual([]);
  });

  it('isolates favorites across users, including removal and reload', async () => {
    const group = await createGroup();
    const app = await createApp(group.id);
    const userA = new Types.ObjectId().toString();
    const userB = new Types.ObjectId().toString();

    await methods.addPortalFavorite(userA, app.id);
    expect((await methods.listEnabledPortalCatalog(userB)).favoriteAppIds).toEqual([]);
    await methods.removePortalFavorite(userB, app.id);
    expect((await methods.listEnabledPortalCatalog(userA)).favoriteAppIds).toEqual([app.id]);

    await methods.addPortalFavorite(userB, app.id);
    await methods.removePortalFavorite(userA, app.id);
    expect((await methods.listEnabledPortalCatalog(userA)).favoriteAppIds).toEqual([]);
    expect((await methods.listEnabledPortalCatalog(userB)).favoriteAppIds).toEqual([app.id]);
  });

  it('prevents deleting a non-empty group', async () => {
    const group = await createGroup();
    await createApp(group.id);

    await expect(methods.deletePortalGroup(group.id)).rejects.toMatchObject({
      code: 'PORTAL_GROUP_NOT_EMPTY',
      status: 409,
    });
  });

  it('enforces case-insensitive app-name uniqueness within a group', async () => {
    const group = await createGroup();
    await createApp(group.id, '经营分析');

    await expect(createApp(group.id, ' 经营分析 ')).rejects.toMatchObject({
      code: 'PORTAL_DUPLICATE_NAME',
      status: 409,
    });
  });

  it('persists portal settings as a singleton and returns plain settings', async () => {
    const saved = await methods.updatePortalSettings({
      brand: {
        companyLogoUrl: '/images/portal/branding/company-logo.webp?v=1',
        portalLogoUrl: '/images/portal/branding/portal-logo.webp?v=1',
      },
      dataCenter: { enabled: true, label: '经营数据', url: 'https://data.example.com/' },
      knowledgeCenter: { enabled: true, label: '企业知识', url: 'https://knowledge.example.com/' },
      updatedBy: 'admin',
    });
    expect(saved.dataCenter.label).toBe('经营数据');
    expect((await methods.getPortalSettings())?.brand.companyLogoUrl).toContain(
      'company-logo.webp',
    );
    expect((await methods.getPortalSettings())?.brand.portalLogoUrl).toContain('portal-logo.webp');

    await mongoose.models.PortalSettings.updateOne(
      { key: 'default' },
      {
        $unset: { 'brand.companyLogoUrl': 1 },
        $set: { 'brand.loginLogoUrl': '/images/portal/branding/legacy-logo.webp?v=1' },
      },
    );
    expect((await methods.getPortalSettings())?.brand.companyLogoUrl).toContain('legacy-logo.webp');

    const updated = await methods.updatePortalSettings({
      dataCenter: { enabled: false, label: '经营数据', url: 'https://data.example.com/' },
      updatedBy: 'admin-2',
    });
    expect(updated.dataCenter.enabled).toBe(false);
    expect(await mongoose.models.PortalSettings.countDocuments()).toBe(1);
  });
});
