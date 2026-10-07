const Router = {
  BASE: 'https://router.project-osrm.org',

  /**
   * Get driving route between ordered waypoints.
   * Returns geometry (GeoJSON), total distance (meters), total duration (seconds).
   */
  async getRoute(waypoints) {
    if (waypoints.length < 2) throw new Error('Se necesitan al menos 2 puntos');

    const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
    // Set steps=true to get per-leg geometries
    const url = `${this.BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok') {
      throw new Error(data.message || 'No se pudo calcular la ruta');
    }

    const route = data.routes[0];
    return {
      geometry: route.geometry,
      legs: route.legs,
      distance: route.distance, // meters
      duration: route.duration, // seconds
    };
  },

  /**
   * Get NxN distance & duration matrix for all waypoints.
   * Single API call, very efficient for TSP optimization.
   */
  async getDistanceMatrix(waypoints) {
    if (waypoints.length < 2) throw new Error('Se necesitan al menos 2 puntos');

    const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
    const url = `${this.BASE}/table/v1/driving/${coords}?annotations=duration,distance`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok') {
      throw new Error(data.message || 'No se pudo obtener la matriz de distancias');
    }

    return {
      durations: data.durations, // seconds, NxN
      distances: data.distances, // meters, NxN
    };
  },

  /**
   * Format distance in meters to human readable.
   */
  formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  },

  /**
   * Format duration in seconds to human readable.
   */
  formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)} seg`;
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs} h ${rem} min` : `${hrs} h`;
  },
};
