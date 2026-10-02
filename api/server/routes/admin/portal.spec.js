const express = require('express');
const request = require('supertest');

jest.mock('@librechat/api', () => ({
  isEnabled: (value) => value === 'true',
  requireAdmin: require('../../../../packages/api/src/middleware/admin').requireAdmin,
  createPortalAdminHandlers: () =>
    Object.fromEntries(
      [
        'catalog',
        'createGroup',
        'updateGroup',
        'deleteGroup',
        'createApp',
        'updateApp',
        'deleteApp',
      ].map((name) => [name, (_req, res) => res.status(200).json({ handler: name })]),
    ),
}));
jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, res, next) => {
    const role = req.get('x-test-role');
    if (!role) return res.status(401).json({ error: 'Authentication required' });
    req.user = { id: 'user-id', email: 'user@example.com', role };
    next();
  },
}));
// A delegated capability must not grant portal management to a non-ADMIN role.
jest.mock('~/server/middleware/roles/capabilities', () => ({
  requireCapability: () => (_req, _res, next) => next(),
}));
jest.mock('~/config/paths', () => ({ imageOutput: '/tmp/portal-test-icons' }));
jest.mock('~/models', () => ({}));

const router = require('./portal');
const app = express();
app.use('/api/admin/portal', router);
const endpoints = [
  ['get', '/catalog'],
  ['post', '/groups'],
  ['patch', '/groups/group-id'],
  ['delete', '/groups/group-id'],
  ['post', '/apps'],
  ['patch', '/apps/app-id'],
  ['delete', '/apps/app-id'],
];

const previousEnabled = process.env.PORTAL_ENABLED;
beforeEach(() => {
  process.env.PORTAL_ENABLED = 'true';
});
afterAll(() => {
  if (previousEnabled === undefined) delete process.env.PORTAL_ENABLED;
  else process.env.PORTAL_ENABLED = previousEnabled;
});

it.each(endpoints)('requires authentication for %s %s', async (method, path) => {
  expect((await request(app)[method](`/api/admin/portal${path}`)).status).toBe(401);
});

it.each(endpoints)(
  'blocks non-admin roles even with delegated capability for %s %s',
  async (method, path) => {
    for (const role of ['USER', 'CUSTOM_ADMIN']) {
      const response = await request(app)
        [method](`/api/admin/portal${path}`)
        .set('x-test-role', role);
      expect(response.status).toBe(403);
      expect(response.body.error_code).toBe('ADMIN_REQUIRED');
    }
  },
);

it.each(endpoints)('allows ADMIN for %s %s', async (method, path) => {
  expect(
    (await request(app)[method](`/api/admin/portal${path}`).set('x-test-role', 'ADMIN')).status,
  ).toBe(200);
});

it('keeps a disabled portal unavailable to ADMIN', async () => {
  process.env.PORTAL_ENABLED = 'false';
  expect(
    (await request(app).get('/api/admin/portal/catalog').set('x-test-role', 'ADMIN')).status,
  ).toBe(404);
});
