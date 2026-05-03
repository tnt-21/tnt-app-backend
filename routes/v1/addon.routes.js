const express = require('express');
const router = express.Router();
const addonController = require('../../controllers/addon.controller');
const { protect, authorize } = require('../../middleware/auth');

// All addon routes are admin-protected for now
router.use(protect);
router.use(authorize('admin', 'super_admin'));

router.get('/', addonController.getAllAddons);
router.post('/', addonController.upsertAddon);
router.delete('/:id', addonController.deleteAddon);

module.exports = router;
