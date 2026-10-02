import { SystemRoles } from 'librechat-data-provider';
import { buildPortalStartupConfig } from './config';

const baseEnv = {
  PORTAL_ENABLED: 'true',
  PORTAL_ALLOW_HTTP: 'true',
  PORTAL_DATA_CENTER_URL: 'http://metabase.internal:3000/',
  PORTAL_DOCUMENT_CENTER_URL: 'https://files.example.com/',
  APP_TITLE: '企业AI中台',
};

describe('buildPortalStartupConfig', () => {
  it('returns no portal config when the feature is disabled', () => {
    expect(
      buildPortalStartupConfig({ PORTAL_ENABLED: 'false' }, SystemRoles.ADMIN),
    ).toBeUndefined();
  });

  it('builds the four-entry navigation for an authenticated user', () => {
    expect(buildPortalStartupConfig(baseEnv, SystemRoles.ADMIN)).toEqual({
      enabled: true,
      brandName: '企业AI中台',
      canManage: true,
      navigation: {
        assistant: { label: 'AI工作台', path: '/c/new' },
        dataCenter: {
          label: '数据中心',
          url: 'http://metabase.internal:3000/',
          mode: 'new_tab',
        },
        documentCenter: {
          label: '知识中心',
          url: 'https://files.example.com/',
          mode: 'new_tab',
        },
        appCenter: { label: '应用中心', path: '/portal/apps' },
      },
    });
  });

  it.each([undefined, '', SystemRoles.USER, 'CUSTOM_ADMIN', 'admin'])(
    'hides management for non-ADMIN role %s',
    (role) => {
      expect(buildPortalStartupConfig(baseEnv, role)?.canManage).toBe(false);
    },
  );

  it('rejects HTTP navigation targets unless explicitly enabled', () => {
    expect(() => buildPortalStartupConfig({ ...baseEnv, PORTAL_ALLOW_HTTP: 'false' })).toThrow(
      'PORTAL_DATA_CENTER_URL must use an allowed HTTP(S) URL',
    );
  });

  it('rejects URLs containing embedded credentials', () => {
    expect(() =>
      buildPortalStartupConfig({
        ...baseEnv,
        PORTAL_DATA_CENTER_URL: 'https://user:secret@example.com/',
      }),
    ).toThrow('without credentials');
  });
});
