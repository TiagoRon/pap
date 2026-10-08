const Geocoder = {
  BASE: 'https://nominatim.openstreetmap.org',
  cache: {},
  lastReqTime: 0,
  MIN_INTERVAL: 1100, // Nominatim requires >= 1 req/s

  CITY_CONFIG: {
    gualeguaychu: {
      viewbox: '-58.58,-33.06,-58.46,-32.96',
      center: [-33.0094, -58.5172],
      name: 'Gualeguaychú',
    },
    concepcion: {
      viewbox: '-58.29,-32.52,-58.19,-32.44',
      center: [-32.4843, -58.2322],
      name: 'Concepción del Uruguay',
    },
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
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      countrycodes: 'ar',
      viewbox: cfg.viewbox,
      bounded: '1',
      addressdetails: '1',
    });

    try {
      let res = await fetch(`${this.BASE}/search?${params}`, {
        headers: { 'Accept-Language': 'es', 'User-Agent': 'PAP-PuertaAPuerta/1.0' },
      });
      let data = await res.json();

      // If no results bounded, retry unbounded with city name appended
      if (data.length === 0) {
        await this._throttle();
        params.set('bounded', '0');
        params.set('q', `${query}, ${cfg.name}, Entre Ríos, Argentina`);
        res = await fetch(`${this.BASE}/search?${params}`, {
          headers: { 'Accept-Language': 'es', 'User-Agent': 'PAP-PuertaAPuerta/1.0' },
        });
        data = await res.json();
      }

      data.forEach((r) => {
        results.push({
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          displayName: r.display_name,
          label: this._buildLabel(r, query),
        });
      });

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
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      addressdetails: '1',
      zoom: '18',
    });

    try {
      const res = await fetch(`${this.BASE}/reverse?${params}`, {
        headers: { 'Accept-Language': 'es', 'User-Agent': 'PAP-PuertaAPuerta/1.0' },
      });
      const data = await res.json();

      const result = {
        lat,
        lng,
        displayName: data.display_name || 'Ubicación sin nombre',
        label: this._buildLabel(data),
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
