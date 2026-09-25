const path = require('path');
const express = require('express');
const multer = require('multer');
const { createPortalAdminHandlers, isEnabled } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const paths = require('~/config/paths');
const db = require('~/models');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1_048_576, files: 1 },
});
const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const handlers = createPortalAdminHandlers({
  iconDir: path.join(paths.imageOutput, 'portal'),
  listAdminPortalCatalog: db.listAdminPortalCatalog,
  createPortalGroup: db.createPortalGroup,
  updatePortalGroup: db.updatePortalGroup,
  deletePortalGroup: db.deletePortalGroup,
  createPortalApp: db.createPortalApp,
  updatePortalApp: db.updatePortalApp,
  deletePortalApp: db.deletePortalApp,
  recordAuditEntry: db.recordAuditEntry,
});

router.use((req, res, next) =>
  isEnabled(process.env.PORTAL_ENABLED)
    ? next()
    : res.status(404).json({ error: 'Portal is disabled' }),
);
router.use(requireJwtAuth, requireAdminAccess);
router.get('/catalog', handlers.catalog);
router.post('/groups', handlers.createGroup);
router.patch('/groups/:groupId', handlers.updateGroup);
router.delete('/groups/:groupId', handlers.deleteGroup);
router.post('/apps', upload.single('icon'), handlers.createApp);
router.patch('/apps/:appId', upload.single('icon'), handlers.updateApp);
router.delete('/apps/:appId', handlers.deleteApp);

module.exports = router;
