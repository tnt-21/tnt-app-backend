const clusterService = require('../services/cluster.service');
const { AppError } = require('../utils/response.util');

exports.autoAssignClusters = async (req, res, next) => {
  try {
    const { overwrite } = req.body;
    const results = await clusterService.autoAssignClusters(overwrite === true);
    res.status(200).json({
      success: true,
      message: 'Auto-assignment completed',
      data: results
    });
  } catch (err) {
    next(err);
  }
};

exports.getClusters = async (req, res, next) => {
  try {
    const { zone } = req.params;
    if (!zone) throw new AppError('Zone is required', 400);
    const clusters = await clusterService.getClustersByZone(zone);
    res.status(200).json({
      success: true,
      data: clusters
    });
  } catch (err) {
    next(err);
  }
};

exports.getPendingBookings = async (req, res, next) => {
  try {
    const { zone } = req.params;
    if (!zone) throw new AppError('Zone is required', 400);
    const pending = await clusterService.getPendingBookings(zone);
    res.status(200).json({
      success: true,
      data: pending
    });
  } catch (err) {
    next(err);
  }
};

exports.removeFromCluster = async (req, res, next) => {
  try {
    const { clusterId, bookingId } = req.params;
    await clusterService.removeBookingFromCluster(clusterId, bookingId);
    res.status(200).json({ success: true, message: 'Booking removed from cluster' });
  } catch (err) {
    next(err);
  }
};

exports.addToCluster = async (req, res, next) => {
  try {
    const { clusterId, bookingId } = req.params;
    await clusterService.addBookingToCluster(clusterId, bookingId);
    res.status(200).json({ success: true, message: 'Booking added to cluster' });
  } catch (err) {
    next(err);
  }
};

exports.swapBooking = async (req, res, next) => {
  try {
    const { clusterId } = req.params;
    const { removeBookingId, addBookingId } = req.body;
    await clusterService.swapBooking(clusterId, removeBookingId, addBookingId);
    res.status(200).json({ success: true, message: 'Bookings swapped successfully' });
  } catch (err) {
    next(err);
  }
};

exports.createManualCluster = async (req, res, next) => {
  try {
    const { zone } = req.body;
    const result = await clusterService.createManualCluster(zone);
    res.status(200).json({ success: true, message: 'Manual cluster created successfully', data: result });
  } catch (err) {
    next(err);
  }
};
