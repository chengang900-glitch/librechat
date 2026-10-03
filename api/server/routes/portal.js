const express = require('express');
const { createPortalHandlers, isEnabled } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();
const handlers = createPortalHandlers({
  listEnabledPortalCatalog: db.listEnabledPortalCatalog,
  findLaunchablePortalApp: db.findLaunchablePortalApp,
  addPortalFavorite: db.addPortalFavorite,
  removePortalFavorite: db.removePortalFavorite,
  recordAuditEntry: db.recordAuditEntry,
});

router.use((req, res, next) =>
  isEnabled(process.env.PORTAL_ENABLED)
    ? next()
    : res.status(404).json({ error: 'Portal is disabled' }),
);
router.use(requireJwtAuth);
router.get('/data-identity', handlers.dataIdentity);
router.get('/catalog', handlers.catalog);
router.put('/favorites/:appId', handlers.addFavorite);
router.delete('/favorites/:appId', handlers.removeFavorite);
router.post('/apps/:appId/launch', handlers.launch);

module.exports = router;
