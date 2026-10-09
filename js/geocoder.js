const Geocoder = {
  BASE: 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer',
  cache: {},
  lastReqTime: 0,
  MIN_INTERVAL: 100, // ArcGIS doesn't have the 1/s strict limit, but we throttle a bit

  CITY_CONFIG: {
    gualeguaychu: {
      viewbox: '-58.58,-33.06,-58.46,-32.96', // keep for fallback if needed
      center: [-33.0094, -58.5172],
      name: 'Gualeguaychú',
    },
    concepcion: {
      viewbox: '-58.29,-32.52,-58.19,-32.44',
      center: [-32.4843, -58.2322],
      name: 'Concepción del Uruguay',
    },
  },

  CUSTOM_OVERRIDES: {
    // Mantengo esta estructura vacía por si en el futuro se necesita forzar alguna,
    // pero con ArcGIS ya no debería ser necesario para las alturas comunes.
  },

  init() {
    this.cache = Storage.getGeocodeCache();
  },

  async _throttle() {
    const now = Date.now();
    const wait = this.MIN_INTERVAL - (now - this.lastReqTime);
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    this.lastReqTime = Date.now();
  },

  /**
   * Forward geocode: address string → results array.
   */
  async search(query, city) {
    const normQ = query.toLowerCase().trim();
    
    // Check custom overrides first (even before cache)
    for (const [overrideKey, overrideData] of Object.entries(this.CUSTOM_OVERRIDES)) {
      if (normQ.includes(overrideKey)) {
        return [{
          lat: overrideData.lat,
          lng: overrideData.lng,
          displayName: overrideData.label + ', Concepción del Uruguay',
          label: overrideData.label
        }];
      }
    }

    const key = `s2:${city}:${normQ}`;
    if (this.cache[key]) return this.cache[key];

    const results = [];

    // Inject base if matches query
    const baseObj = city === 'gualeguaychu' ? Storage.getBaseGchu() : Storage.getBaseCdu();
    if (baseObj && baseObj.address) {
      const normBase = baseObj.address.toLowerCase();
      if (normBase.includes(normQ) || normQ === 'base' || normQ.includes(normBase)) {
        results.push({
          lat: baseObj.lat,
          lng: baseObj.lng,
          displayName: `🌟 (Base Guardada) ${baseObj.address}`,
          label: baseObj.address
        });
      }
    }

    await this._throttle();

    const cfg = this.CITY_CONFIG[city];
    const searchCenter = `${cfg.center[1]},${cfg.center[0]}`; // lon, lat

    const params = new URLSearchParams({
      singleLine: `${query}, ${cfg.name}, Entre Ríos, Argentina`,
      f: 'json',
      maxLocations: '5',
      outFields: 'Match_addr,Addr_type',
      location: searchCenter,
      distance: '10000', // 10km search radius
    });

    try {
      let res = await fetch(`${this.BASE}/findAddressCandidates?${params}`, {
        headers: { 'Accept-Language': 'es' },
      });
      let data = await res.json();

      if (data.candidates) {
        data.candidates.forEach((r) => {
          results.push({
            lat: parseFloat(r.location.y),
            lng: parseFloat(r.location.x),
            displayName: r.address,
            label: r.address.split(',')[0],
          });
        });
      }

      this.cache[key] = results;
      this._persistCache();
      return results;
    } catch (err) {
      console.error('Geocoder search error:', err);
      return results;
    }
  },

  /**
   * Reverse geocode: lat/lng → address info.
   */
  async reverse(lat, lng) {
    const key = `r2:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    if (this.cache[key]) return this.cache[key];

    await this._throttle();

    const params = new URLSearchParams({
      location: `${lng},${lat}`,
      f: 'json',
      outFields: 'Match_addr',
    });

    try {
      const res = await fetch(`${this.BASE}/reverseGeocode?${params}`, {
        headers: { 'Accept-Language': 'es' },
      });
      const data = await res.json();

      let displayName = 'Ubicación sin nombre';
      let label = 'Ubicación';

      if (data && data.address) {
        displayName = data.address.LongLabel || data.address.Match_addr || displayName;
        label = data.address.ShortLabel || data.address.Address || label;
      }

      const result = {
        lat,
        lng,
        displayName,
        label,
      };

      this.cache[key] = result;
      this._persistCache();
      return result;
    } catch (err) {
      console.error('Geocoder reverse error:', err);
      return { lat, lng, displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, label: 'Ubicación' };
    }
  },

  _buildLabel(result, query = '') {
    const addr = result.address || {};
    const road = addr.road || addr.pedestrian || addr.footway || '';
    const number = addr.house_number || '';
    const city = addr.city || addr.town || addr.village || '';

    if (road && number) {
      return `${road} ${number}`;
    }

    if (road && query) {
      // Si OSM no tiene la altura, la intentamos sacar de lo que escribió el usuario
      const queryNums = query.match(/\d+/g);
      if (queryNums) {
        const lastNum = queryNums[queryNums.length - 1];
        // Si el número no es parte del nombre de la calle (ej: "14 de julio"), lo agregamos
        if (!road.includes(lastNum)) {
          return `${road} ${lastNum}`;
        }
      }
    }

    if (road) return road;
    if (city) return city;
    return result.display_name ? result.display_name.split(',')[0] : 'Ubicación';
  },

  _persistCache() {
    const keys = Object.keys(this.cache);
    if (keys.length > 300) {
      const remove = keys.slice(0, keys.length - 200);
      remove.forEach((k) => delete this.cache[k]);
    }
    Storage.setGeocodeCache(this.cache);
  },
};
