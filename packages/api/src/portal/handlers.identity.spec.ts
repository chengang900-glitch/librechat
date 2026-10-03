import { createPortalHandlers } from './handlers';
import type { ServerRequest } from '~/types/http';
import type { Response } from 'express';

const deps = {
  listEnabledPortalCatalog: jest.fn(),
  findLaunchablePortalApp: jest.fn(),
  addPortalFavorite: jest.fn(),
  removePortalFavorite: jest.fn(),
};
const handler = createPortalHandlers(deps).dataIdentity;
const reply = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

describe('Portal data identity', () => {
  it('returns only the authenticated OpenID issuer and subject, without tokens or email', async () => {
    const res = reply();
    await handler(
      {
        user: {
          provider: 'openid',
          openidId: 'subject-a',
          openidIssuer: 'https://identity.example/realms/test',
          email: 'private@example.com',
        },
      } as ServerRequest,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      issuer: 'https://identity.example/realms/test',
      subject: 'subject-a',
    });
    expect(deps.listEnabledPortalCatalog).not.toHaveBeenCalled();
  });
  it.each([undefined, { provider: 'local' }, { provider: 'openid', openidId: 'subject-a' }])(
    'rejects missing or non-OIDC identities',
    async (user) => {
      const res = reply();
      await handler({ user } as ServerRequest, res as unknown as Response);
      expect(res.status).toHaveBeenCalledWith(403);
    },
  );
});
