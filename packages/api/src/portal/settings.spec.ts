import { createPortalSettingsHandlers } from './settings';

const response = () => {
  const result = { statusCode: 0, body: undefined as unknown };
  const res = {
    status: (statusCode: number) => {
      result.statusCode = statusCode;
      return res;
    },
    json: (body: unknown) => {
      result.body = body;
      return res;
    },
  };
  return { result, res };
};

const settings = {
  brand: {},
  dataCenter: { enabled: true, label: '数据中心', url: 'https://data.example.com/' },
  knowledgeCenter: { enabled: true, label: '知识中心', url: 'https://knowledge.example.com/' },
};

describe('portal settings handlers', () => {
  it('rejects HTTP addresses unless explicitly allowed', async () => {
    const handlers = createPortalSettingsHandlers({
      getPortalSettings: async () => settings,
      updatePortalSettings: async () => settings,
      brandingDir: '/tmp/portal-branding',
      allowHttp: false,
    });
    const { result, res } = response();
    await handlers.update(
      {
        body: {
          dataCenter: { enabled: true, label: '数据中心', url: 'http://127.0.0.1:3000/' },
        },
        user: { id: 'admin' },
      } as never,
      res as never,
    );
    expect(result.statusCode).toBe(400);
  });

  it('updates valid settings with the authenticated administrator', async () => {
    const update = jest.fn(async (input) => ({ ...settings, ...input }));
    const handlers = createPortalSettingsHandlers({
      getPortalSettings: async () => settings,
      updatePortalSettings: update,
      brandingDir: '/tmp/portal-branding',
      allowHttp: true,
    });
    const { result, res } = response();
    await handlers.update(
      {
        body: {
          dataCenter: { enabled: true, label: '经营数据', url: 'http://127.0.0.1:3000/' },
        },
        user: { id: 'admin' },
      } as never,
      res as never,
    );
    expect(result.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith({
      dataCenter: { enabled: true, label: '经营数据', url: 'http://127.0.0.1:3000/' },
      updatedBy: 'admin',
    });
  });
});
