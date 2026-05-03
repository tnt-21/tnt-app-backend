const express = require('express');
const router = express.Router();
const clusterController = require('../../controllers/cluster.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

// Protect all cluster routes to admin only
router.use(authenticate, authorize('admin', 'super_admin'));

router.post('/auto-assign', clusterController.autoAssignClusters);
router.post('/manual', clusterController.createManualCluster);
router.get('/zone/:zone', clusterController.getClusters);
router.get('/zone/:zone/pending', clusterController.getPendingBookings);

router.delete('/:clusterId/booking/:bookingId', clusterController.removeFromCluster);
router.post('/:clusterId/booking/:bookingId', clusterController.addToCluster);
router.post('/:clusterId/swap', clusterController.swapBooking);

module.exports = router;
