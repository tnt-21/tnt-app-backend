// ============================================
// FILE: utils/clustering.util.js
// Geographic clustering algorithms for route optimization
// ============================================

/**
 * Calculate Haversine distance between two lat/lng points
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Simple radius-based clustering
 * Groups requests within max_radius_km of center point
 * @param {Array} requests - Array of request objects with latitude, longitude
 * @param {Object} center - Center point {lat, lng}
 * @param {number} maxRadiusKm - Maximum radius in km
 * @param {number} maxClusterSize - Maximum requests per cluster
 * @returns {Array} Array of clusters
 */
function radiusBasedClustering(requests, center, maxRadiusKm = 10, maxClusterSize = 6) {
  const withinRadius = [];
  
  for (const request of requests) {
    const distance = haversineDistance(
      center.lat,
      center.lng,
      request.latitude,
      request.longitude
    );
    
    if (distance <= maxRadiusKm) {
      withinRadius.push({
        ...request,
        distanceFromCenter: distance
      });
    }
  }
  
  // Sort by distance from center
  withinRadius.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter);
  
  // Create clusters of maxClusterSize
  const clusters = [];
  for (let i = 0; i < withinRadius.length; i += maxClusterSize) {
    clusters.push(withinRadius.slice(i, i + maxClusterSize));
  }
  
  return clusters;
}

/**
 * Density-based clustering (simplified DBSCAN)
 * Auto-detects dense areas without predefined center
 * @param {Array} requests - Array of request objects with latitude, longitude
 * @param {number} epsKm - Maximum distance between points in a cluster (km)
 * @param {number} minSamples - Minimum requests to form a cluster
 * @returns {Array} Array of clusters
 */
function dbscanClustering(requests, epsKm = 3, minSamples = 3) {
  const clusters = [];
  const visited = new Set();
  const noise = [];
  
  for (let i = 0; i < requests.length; i++) {
    if (visited.has(i)) continue;
    
    visited.add(i);
    const neighbors = getNeighbors(requests, i, epsKm);
    
    if (neighbors.length < minSamples) {
      noise.push(requests[i]);
    } else {
      const cluster = [];
      expandCluster(requests, i, neighbors, cluster, visited, epsKm, minSamples);
      clusters.push(cluster);
    }
  }
  
  return clusters;
}

function getNeighbors(requests, index, epsKm) {
  const neighbors = [];
  const point = requests[index];
  
  for (let i = 0; i < requests.length; i++) {
    if (i === index) continue;
    
    const distance = haversineDistance(
      point.latitude,
      point.longitude,
      requests[i].latitude,
      requests[i].longitude
    );
    
    if (distance <= epsKm) {
      neighbors.push(i);
    }
  }
  
  return neighbors;
}

function expandCluster(requests, index, neighbors, cluster, visited, epsKm, minSamples) {
  cluster.push(requests[index]);
  
  for (const neighborIdx of neighbors) {
    if (!visited.has(neighborIdx)) {
      visited.add(neighborIdx);
      const neighborNeighbors = getNeighbors(requests, neighborIdx, epsKm);
      
      if (neighborNeighbors.length >= minSamples) {
        neighbors.push(...neighborNeighbors);
      }
    }
    
    // Add to cluster if not already in any cluster
    if (!cluster.some(r => r.request_id === requests[neighborIdx].request_id)) {
      cluster.push(requests[neighborIdx]);
    }
  }
}

/**
 * Find the densest cluster from an array of clusters
 * @param {Array} clusters - Array of clusters
 * @returns {Array} The densest cluster
 */
function getDensestCluster(clusters) {
  if (clusters.length === 0) return [];
  
  return clusters.reduce((densest, current) => 
    current.length > densest.length ? current : densest
  );
}

/**
 * Calculate cluster centroid (geographic center)
 * @param {Array} cluster - Array of requests
 * @returns {Object} {lat, lng}
 */
function getClusterCentroid(cluster) {
  if (cluster.length === 0) return null;
  
  const sumLat = cluster.reduce((sum, r) => sum + parseFloat(r.latitude), 0);
  const sumLng = cluster.reduce((sum, r) => sum + parseFloat(r.longitude), 0);
  
  return {
    lat: sumLat / cluster.length,
    lng: sumLng / cluster.length
  };
}

module.exports = {
  haversineDistance,
  radiusBasedClustering,
  dbscanClustering,
  getDensestCluster,
  getClusterCentroid
};
