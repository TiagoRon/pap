const Optimizer = {
  /**
   * Nearest Neighbor heuristic for TSP.
   */
  nearestNeighbor(matrix, startIndex, endIndex = null) {
    const n = matrix.length;
    const visited = new Set([startIndex]);
    if (endIndex !== null) visited.add(endIndex); // Temporarily mark end as visited so we don't pick it

    const route = [startIndex];
    let current = startIndex;

    while (route.length < (endIndex !== null ? n - 1 : n)) {
      let nearest = -1;
      let nearestCost = Infinity;

      for (let i = 0; i < n; i++) {
        if (!visited.has(i)) {
          const cost = matrix[current][i];
          if (cost !== null && cost < nearestCost) {
            nearestCost = cost;
            nearest = i;
          }
        }
      }

      if (nearest === -1) break; 
      visited.add(nearest);
      route.push(nearest);
      current = nearest;
    }

    if (endIndex !== null && route.length === n - 1) {
      route.push(endIndex);
    }

    return route;
  },

  routeCost(route, matrix) {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const cost = matrix[route[i]][route[i + 1]];
      if (cost === null || cost === undefined) return Infinity;
      total += cost;
    }
    return total;
  },

  /**
   * 2-opt local search improvement.
   */
  twoOpt(route, matrix, fixStart, fixEnd) {
    const n = route.length;
    if (n <= 3) return route;

    let best = [...route];
    let bestCost = this.routeCost(best, matrix);
    let improved = true;
    let iterations = 0;
    const maxIter = 500;

    const iStart = fixStart ? 1 : 0;
    const iEnd = fixEnd ? n - 2 : n - 1;

    while (improved && iterations < maxIter) {
      improved = false;
      iterations++;

      for (let i = iStart; i < iEnd; i++) {
        for (let j = i + 1; j <= iEnd; j++) {
          const candidate = [...best];
          // Reverse segment [i, j]
          let left = i;
          let right = j;
          while (left < right) {
            [candidate[left], candidate[right]] = [candidate[right], candidate[left]];
            left++;
            right--;
          }

          const candidateCost = this.routeCost(candidate, matrix);
          if (candidateCost < bestCost - 0.001) {
            best = candidate;
            bestCost = candidateCost;
            improved = true;
          }
        }
      }
    }

    return best;
  },

  /**
   * Main optimization entry point.
   */
  optimize(matrix, startIndex = null, endIndex = null) {
    const n = matrix.length;
    if (n === 0) return [];
    if (n === 1) return [0];
    if (n === 2) {
      if (startIndex !== null && endIndex !== null) return [startIndex, endIndex];
      if (startIndex !== null) return [startIndex, 1 - startIndex];
      if (endIndex !== null) return [1 - endIndex, endIndex];
      return [0, 1];
    }

    const hasFixedStart = startIndex !== null;
    const hasFixedEnd = endIndex !== null;

    let bestRoute = null;
    let bestCost = Infinity;

    // Determine start points to try
    const startPoints = hasFixedStart ? [startIndex] : Array.from({length: n}, (_, i) => i).filter(i => i !== endIndex);

    for (const s of startPoints) {
      const nn = this.nearestNeighbor(matrix, s, endIndex);
      
      // If we couldn't build a full route (e.g. disconnected graph), skip
      if (nn.length < n) continue;

      const optimized = this.twoOpt(nn, matrix, hasFixedStart, hasFixedEnd);
      const cost = this.routeCost(optimized, matrix);

      if (cost < bestCost) {
        bestCost = cost;
        bestRoute = optimized;
      }
    }

    return bestRoute || Array.from({ length: n }, (_, i) => i);
  },
};
