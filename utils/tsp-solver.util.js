// ============================================
// FILE: utils/tsp-solver.util.js
// Traveling Salesman Problem solver for route optimization
// ============================================

const { haversineDistance } = require('./clustering.util');

/**
 * Solve TSP using Nearest Neighbor heuristic
 * Fast and good enough for small routes (< 10 stops)
 * @param {Object} startLocation - {lat, lng} van base location
 * @param {Array} stops - Array of stop objects with latitude, longitude
 * @returns {Array} Optimized sequence of stops
 */
function nearestNeighborTSP(startLocation, stops) {
  if (stops.length === 0) return [];
  if (stops.length === 1) return stops;
  
  const route = [];
  const remaining = [...stops];
  let currentLat = startLocation.lat;
  let currentLng = startLocation.lng;
  
  while (remaining.length > 0) {
    let nearestIdx = -1;
    let minDistance = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineDistance(
        currentLat,
        currentLng,
        remaining[i].latitude,
        remaining[i].longitude
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestIdx = i;
      }
    }
    
    const nearest = remaining.splice(nearestIdx, 1)[0];
    route.push({
      ...nearest,
      travelDistanceKm: minDistance
    });
    
    currentLat = nearest.latitude;
    currentLng = nearest.longitude;
  }
  
  return route;
}

/**
 * Calculate total route distance
 * @param {Object} startLocation - {lat, lng}
 * @param {Array} route - Ordered array of stops
 * @returns {number} Total distance in km
 */
function calculateRouteDistance(startLocation, route) {
  if (route.length === 0) return 0;
  
  let totalDistance = 0;
  let prevLat = startLocation.lat;
  let prevLng = startLocation.lng;
  
  for (const stop of route) {
    totalDistance += haversineDistance(prevLat, prevLng, stop.latitude, stop.longitude);
    prevLat = stop.latitude;
    prevLng = stop.longitude;
  }
  
  return totalDistance;
}

/**
 * 2-opt improvement for route optimization
 * Attempts to improve route by reversing segments
 * @param {Object} startLocation - {lat, lng}
 * @param {Array} route - Current route
 * @param {number} maxIterations - Maximum improvement attempts
 * @returns {Array} Improved route
 */
function twoOptImprovement(startLocation, route, maxIterations = 100) {
  if (route.length < 4) return route;
  
  let improved = true;
  let iterations = 0;
  let currentRoute = [...route];
  let currentDistance = calculateRouteDistance(startLocation, currentRoute);
  
  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    
    for (let i = 0; i < currentRoute.length - 1; i++) {
      for (let j = i + 2; j < currentRoute.length; j++) {
        // Try reversing segment between i and j
        const newRoute = [
          ...currentRoute.slice(0, i + 1),
          ...currentRoute.slice(i + 1, j + 1).reverse(),
          ...currentRoute.slice(j + 1)
        ];
        
        const newDistance = calculateRouteDistance(startLocation, newRoute);
        
        if (newDistance < currentDistance) {
          currentRoute = newRoute;
          currentDistance = newDistance;
          improved = true;
        }
      }
    }
  }
  
  return currentRoute;
}

/**
 * Calculate travel time between two points
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} avgSpeedKmph - Average speed in km/h
 * @returns {number} Travel time in minutes
 */
function calculateTravelTime(distanceKm, avgSpeedKmph = 30) {
  return Math.round((distanceKm / avgSpeedKmph) * 60);
}

/**
 * Assign time slots to route stops
 * @param {Object} params - {startTime, route, serviceDurationMinutes, bufferMinutes, avgSpeedKmph}
 * @returns {Array} Route with time assignments
 */
function assignTimeSlots({
  startTime = '09:00:00',
  route,
  serviceDurationMinutes = 90,
  bufferMinutes = 10,
  avgSpeedKmph = 30,
  startLocation
}) {
  const routeWithTimes = [];
  let currentTime = timeToMinutes(startTime);
  
  for (let i = 0; i < route.length; i++) {
    const stop = route[i];
    
    // Calculate travel time from previous stop (or van base)
    let travelTimeMinutes = 0;
    if (i === 0) {
      const distanceFromBase = haversineDistance(
        startLocation.lat,
        startLocation.lng,
        stop.latitude,
        stop.longitude
      );
      travelTimeMinutes = calculateTravelTime(distanceFromBase, avgSpeedKmph);
    } else {
      const prevStop = route[i - 1];
      const distance = haversineDistance(
        prevStop.latitude,
        prevStop.longitude,
        stop.latitude,
        stop.longitude
      );
      travelTimeMinutes = calculateTravelTime(distance, avgSpeedKmph);
    }
    
    // Add travel time and buffer
    currentTime += travelTimeMinutes + bufferMinutes;
    
    const arrivalTime = minutesToTime(currentTime);
    const departureTime = minutesToTime(currentTime + serviceDurationMinutes);
    
    routeWithTimes.push({
      ...stop,
      sequence: i + 1,
      travelTimeMinutes,
      arrivalTime,
      departureTime,
      serviceDurationMinutes
    });
    
    currentTime += serviceDurationMinutes;
  }
  
  return routeWithTimes;
}

/**
 * Check if route fits within time window
 * @param {Array} route - Route with time assignments
 * @param {string} endTime - End time (e.g., '18:00:00')
 * @returns {boolean} True if route fits
 */
function routeFitsTimeWindow(route, endTime = '18:00:00') {
  if (route.length === 0) return true;
  
  const lastStop = route[route.length - 1];
  return lastStop.departureTime <= endTime;
}

// Helper functions
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

module.exports = {
  nearestNeighborTSP,
  calculateRouteDistance,
  twoOptImprovement,
  calculateTravelTime,
  assignTimeSlots,
  routeFitsTimeWindow
};
