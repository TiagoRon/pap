const MapManager = {
  map: null,
  markers: {},
  tempMarker: null,
  routeLayer: null,

  CITIES: {
    gualeguaychu: { center: [-33.0094, -58.5172], zoom: 14 },
    concepcion:   { center: [-32.4843, -58.2322], zoom: 14 },
  },

  init() {
    this.map = L.map('map', { zoomControl: false, tap: true });

    // Standard OSM with CSS filter for dark mode
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OSM',
      className: 'dark-tiles'
    }).addTo(this.map);
  },

  setCity(city) {
    const c = this.CITIES[city];
    if (c) this.map.setView(c.center, c.zoom, { animate: true });
  },

  // ── Markers ──

  _icon(num, cls, colorStyle = '') {
    return L.divIcon({
      className: '',
      html: `<div class="marker-num ${cls || ''}" ${colorStyle}>${num}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -20],
    });
  },

  setTempMarker(lat, lng) {
    this.clearTempMarker();
    this.tempMarker = L.marker([lat, lng], { icon: this._icon('?', 'temp') }).addTo(this.map);
    this.map.setView([lat, lng], Math.max(this.map.getZoom(), 16), { animate: true });
  },

  clearTempMarker() {
    if (this.tempMarker) { this.map.removeLayer(this.tempMarker); this.tempMarker = null; }
  },

  updateAllMarkers(stops, optimized, doneSet, basesOrStart = [], legacyEndPoint = null) {
    Object.values(this.markers).forEach(m => this.map.removeLayer(m));
    if (this.baseMarkers) this.baseMarkers.forEach(m => this.map.removeLayer(m));
    this.markers = {};
    this.baseMarkers = [];

    // Format bases array
    let bases = [];
    if (Array.isArray(basesOrStart)) {
      bases = basesOrStart;
    } else if (basesOrStart && typeof basesOrStart.lat === 'number') {
      bases.push({
        type: 'gchu',
        name: 'Base Salida',
        point: basesOrStart,
        emote: '🏢',
        role: 'start'
      });
      if (legacyEndPoint && typeof legacyEndPoint.lat === 'number') {
        bases.push({
          type: 'cdu',
          name: 'Base Llegada',
          point: legacyEndPoint,
          emote: '🏢',
          role: 'end'
        });
      }
    }

    // Draw base points if they exist
    bases.forEach(base => {
      if (!base || !base.point) return;
      let lat = parseFloat(base.point.lat);
      let lng = parseFloat(base.point.lng);
      if (isNaN(lat) || isNaN(lng) || !lat || !lng) {
        lat = base.type === 'gchu' ? -33.0089 : -32.4828;
        lng = base.type === 'gchu' ? -58.5147 : -58.2335;
      }
      const emote = base.emote || (base.type === 'gchu' ? '🏢' : '🏢');
      const roleClass = base.role || 'base';
      const label = base.name || (base.type === 'gchu' ? 'Base Gchu' : 'Base Cdu');
      const address = base.point.address || 'Base fija';

      const iconHtml = `
        <div class="marker-base-container ${base.type || ''} ${roleClass}">
          <div class="marker-base-pin">
            <span class="base-emoji">${emote}</span>
          </div>
          <div class="marker-base-tip"></div>
          <div class="marker-base-badge">${label}</div>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'marker-base-leaflet',
        iconSize: [110, 76],
        iconAnchor: [55, 52],
        popupAnchor: [0, -50]
      });

      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: 1000,
        interactive: true
      }).addTo(this.map);

      const popupHtml = `
        <div class="popup-card">
          <div class="popup-num" style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:22px;">${emote}</span>
            <span>${this._esc(label)}</span>
          </div>
          <div class="popup-addr">${this._esc(address)}</div>
          <div class="popup-actions">
            <button class="popup-btn popup-btn-nav" onclick="App.navigateTo(${base.point.lat}, ${base.point.lng})">🚗 Navegar con Google Maps</button>
            <button class="popup-btn" style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);" onclick="App.openSettingsSheet()">⚙️ Configurar Base</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 280, closeButton: false });
      this.baseMarkers.push(marker);
    });

    const passHues = {};
    let hueCounter = 0;

    stops.forEach((stop, i) => {
      const isDone = doneSet && doneSet.has(stop.id);
      let cls = optimized ? 'optimized' : '';
      if (isDone) cls = 'done';
      
      const hue = stop.hue !== undefined ? stop.hue : 0;
      const colorStyle = !isDone ? `style="background: hsl(${hue}, 85%, 45%); border-color: hsl(${hue}, 85%, 45%);"` : '';

      const markerName = stop.name || (stop.cityStr ? stop.cityStr.split(' ')[0] : null);
      const markerText = markerName ? markerName.charAt(0).toUpperCase() : (i + 1);

      const marker = L.marker([stop.lat, stop.lng], { icon: this._icon(markerText, cls, colorStyle) }).addTo(this.map);

      const popupHtml = `
        <div class="popup-card">
          <div class="popup-num">${markerName ? 'Pasajero: ' + markerName : 'Parada ' + (i + 1)}</div>
          <div class="popup-addr">${this._esc(stop.address)}</div>
          <div class="popup-actions">
            <button class="popup-btn popup-btn-nav" onclick="App.navigateTo('${stop.id}')">🚗 Navegar con Google Maps</button>
            <button class="popup-btn popup-btn-edit" onclick="App.editStopName('${stop.id}')">✏️ Editar nombre</button>
            <button class="popup-btn popup-btn-del" onclick="App.deleteStop('${stop.id}')">Eliminar</button>
          </div>
        </div>`;

      marker.bindPopup(popupHtml, { maxWidth: 280, closeButton: false });
      this.markers[stop.id] = marker;
    });
  },

  openPopup(id) {
    const m = this.markers[id];
    if (m) {
      this.map.setView(m.getLatLng(), Math.max(this.map.getZoom(), 16), { animate: true });
      setTimeout(() => m.openPopup(), 300);
    }
  },

  // ── Route ──

  drawRoute(route, orderedWaypoints, doneSet) {
    this.clearRoute();
    if (!route.legs) return;

    const layers = [];
    let dashOffsetToggle = 0;

    for (let i = 0; i < route.legs.length; i++) {
      const leg = route.legs[i];
      const targetWaypoint = orderedWaypoints[i + 1];
      
      let isDone = false;
      if (doneSet && targetWaypoint && targetWaypoint.id) {
        isDone = doneSet.has(targetWaypoint.id);
      }
      
      let color = '#2D8CFF'; // Default blue
      if (isDone) {
        color = '#555566'; // Gray out the completed segment
      } else if (targetWaypoint && targetWaypoint.hue !== undefined) {
        color = `hsl(${targetWaypoint.hue}, 85%, 45%)`;
      }
      
      // Extract geometry from steps
      let legCoords = [];
      if (leg.steps) {
        for (const step of leg.steps) {
          if (step.geometry && step.geometry.coordinates) {
             const c = step.geometry.coordinates.map(coord => [coord[1], coord[0]]);
             legCoords.push(...c);
          }
        }
      }
      
      if (legCoords.length === 0) continue;

      layers.push(L.polyline(legCoords, {
        color: color,
        weight: 6,
        opacity: 0.9,
        lineCap: 'round', lineJoin: 'round',
        dashArray: '12, 12',
        dashOffset: dashOffsetToggle === 0 ? '0' : '12'
      }));
      
      dashOffsetToggle = 1 - dashOffsetToggle;
    }
    
    this.routeLayer = L.featureGroup(layers).addTo(this.map);
  },

  clearRoute() {
    if (this.routeLayer) { this.map.removeLayer(this.routeLayer); this.routeLayer = null; }
  },

  fitAll() {
    const layers = Object.values(this.markers);
    if (this.baseMarkers && this.baseMarkers.length > 0) layers.push(...this.baseMarkers);
    if (this.routeLayer) layers.push(this.routeLayer);
    if (layers.length === 0) return;
    this.map.fitBounds(L.featureGroup(layers).getBounds().pad(0.12), { animate: true });
  },

  fitStops() {
    const layers = Object.values(this.markers);
    if (layers.length === 0 && this.baseMarkers && this.baseMarkers.length > 0) {
      layers.push(...this.baseMarkers);
    }
    if (layers.length === 0) return;
    this.map.fitBounds(L.featureGroup(layers).getBounds().pad(0.12), { animate: true });
  },

  userMarker: null,
  watchId: null,

  locateUser() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('GPS no disponible'));
      
      if (!this.watchId) {
        this.watchId = navigator.geolocation.watchPosition(
          p => {
            const lat = p.coords.latitude;
            const lng = p.coords.longitude;
            
            if (!this.userMarker) {
              const iconHtml = `<div style="width: 18px; height: 18px; background: #00FFCC; border: 3px solid #1c1c1c; border-radius: 50%; box-shadow: 0 0 12px #00FFCC;"></div>`;
              const icon = L.divIcon({
                html: iconHtml,
                className: 'user-loc-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });
              this.userMarker = L.marker([lat, lng], { icon, zIndexOffset: 2000, interactive: false }).addTo(this.map);
            } else {
              this.userMarker.setLatLng([lat, lng]);
            }
          },
          err => console.warn('Error en watchPosition:', err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }

      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => reject(new Error('No se pudo obtener ubicación')),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  },

  _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
};
