const Storage = {
  KEYS: {
    CITY: 'pap_city',
    STOPS: 'pap_stops',
    BASE_GCHU: 'pap_base_gchu',
    BASE_CDU: 'pap_base_cdu',
    BASE_EMOTE_GCHU: 'pap_base_emote_gchu',
    BASE_EMOTE_CDU: 'pap_base_emote_cdu',
    TRIP_TYPE: 'pap_trip_type',
    ROUTE_DATA: 'pap_route_data',
    GEOCODE_CACHE: 'pap_geo_cache',
  },

  DEFAULT_BASES: {
    gchu: {
      lat: -33.0274,
      lng: -58.5285,
      address: 'Terminal de Ómnibus, Gualeguaychú',
      name: 'Base Gualeguaychú'
    },
    cdu: {
      lat: -32.4839,
      lng: -58.2435,
      address: 'Terminal de Ómnibus, Concepción del Uruguay',
      name: 'Base Concepción'
    }
  },

  _save(key, data) {
    try { 
      localStorage.setItem(key, JSON.stringify(data)); 
      if (window.SyncManager) window.SyncManager.push();
    }
    catch (e) { console.warn('Storage save error:', e); }
  },

  _load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Storage load error:', e);
      return null;
    }
  },

  _remove(key) { 
    localStorage.removeItem(key); 
    if (window.SyncManager) window.SyncManager.push();
  },

  // City
  getCity() { return this._load(this.KEYS.CITY) || 'gualeguaychu'; },
  setCity(city) { this._save(this.KEYS.CITY, city); },

  // Stops
  getStops() { return this._load(this.KEYS.STOPS) || []; },
  setStops(stops) { this._save(this.KEYS.STOPS, stops); },

  // Bases
  getBaseGchu() {
    let val = this._load(this.KEYS.BASE_GCHU);
    if (val === null && !this._load('pap_cleared_gchu')) {
      return this.DEFAULT_BASES.gchu;
    }
    if (val && (typeof val.lat !== 'number' || typeof val.lng !== 'number' || isNaN(val.lat) || isNaN(val.lng))) {
      val.lat = this.DEFAULT_BASES.gchu.lat;
      val.lng = this.DEFAULT_BASES.gchu.lng;
    }
    return val;
  },
  setBaseGchu(point) {
    if (point) {
      this._save(this.KEYS.BASE_GCHU, point);
      this._remove('pap_cleared_gchu');
    } else {
      this._remove(this.KEYS.BASE_GCHU);
      this._save('pap_cleared_gchu', true);
    }
  },

  getBaseCdu() {
    let val = this._load(this.KEYS.BASE_CDU);
    if (val === null && !this._load('pap_cleared_cdu')) {
      return this.DEFAULT_BASES.cdu;
    }
    if (val && (typeof val.lat !== 'number' || typeof val.lng !== 'number' || isNaN(val.lat) || isNaN(val.lng))) {
      val.lat = this.DEFAULT_BASES.cdu.lat;
      val.lng = this.DEFAULT_BASES.cdu.lng;
    }
    return val;
  },
  setBaseCdu(point) {
    if (point) {
      this._save(this.KEYS.BASE_CDU, point);
      this._remove('pap_cleared_cdu');
    } else {
      this._remove(this.KEYS.BASE_CDU);
      this._save('pap_cleared_cdu', true);
    }
  },

  getBaseEmote(city) {
    const key = city === 'gchu' ? this.KEYS.BASE_EMOTE_GCHU : this.KEYS.BASE_EMOTE_CDU;
    return this._load(key) || '🏢';
  },
  setBaseEmote(city, emote) {
    const key = city === 'gchu' ? this.KEYS.BASE_EMOTE_GCHU : this.KEYS.BASE_EMOTE_CDU;
    this._save(key, emote);
  },

  // Trip Type
  getTripType() { return this._load(this.KEYS.TRIP_TYPE) || 'gchu_cdu'; },
  setTripType(type) { this._save(this.KEYS.TRIP_TYPE, type); },

  // Route Data (distance, duration, etc)
  getRouteData() { return this._load(this.KEYS.ROUTE_DATA); },
  setRouteData(data) {
    if (data) this._save(this.KEYS.ROUTE_DATA, data);
    else this._remove(this.KEYS.ROUTE_DATA);
  },

  // Geocode Cache
  getGeocodeCache() { return this._load(this.KEYS.GEOCODE_CACHE) || {}; },
  setGeocodeCache(cache) { this._save(this.KEYS.GEOCODE_CACHE, cache); },

  // Clear current route (keeps bases configured)
  clearRoute() {
    this._remove(this.KEYS.STOPS);
    this._remove(this.KEYS.ROUTE_DATA);
  },
};
