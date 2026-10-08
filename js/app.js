/* ═══════════════════════════════════════
   PAP — App Controller (Dark Navigation)
   ═══════════════════════════════════════ */

const App = {
  stops: [],
  doneStops: new Set(),
  tripType: 'gchu_cdu',
  searchCity: 'gualeguaychu',
  routeCalculated: false,
  activeStopId: null,
  currentRoute: null,
  currentWaypoints: null,
  
  tapMode: false,
  pendingTap: null,
  searchTimer: null,
  toastTimer: null,
  _searchResults: [],

  // ── Init ──

  init() {
    try {
      Geocoder.init();
      MapManager.init();

    this.tripType = Storage.getTripType();
    this.stops = Storage.getStops();
    
    // Load route state if calculated previously (simplified for session)
    // We could store routeCalculated in Storage, but for now we'll reset it to false on load to force recalculation if needed, 
    // or just assume if we have stops we might want to optimize them. Let's keep it simple.

    this._setupTopBar();
    this._setupBottomPanel();
    this._setupSheets();
    this._setupSettingsSheet();
    this._setupSearchSheet();
    this._setupGmapsSheet();
    this._setupTapMode();

    this._updateTripUI();
    this._updateUI();

    // Always render base markers and stops immediately on map
    this._updateMapMarkers();

    if (this.stops.length > 0) {
      setTimeout(() => MapManager.fitStops(), 400);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    
    if (window.SyncManager) window.SyncManager.init();
    
    } catch (err) {
      alert("Error en init: " + err.message + "\n" + err.stack);
    }
  },

  // ═══════════════════════════════════════
  //  TOP BAR
  // ═══════════════════════════════════════

  _setupTopBar() {
    document.getElementById('btn-trip').addEventListener('click', () => {
      this._openSheet('sheet-trip');
    });

    document.getElementById('btn-locate').addEventListener('click', async () => {
      try {
        this.showToast('Ubicando…');
        const pos = await MapManager.locateUser();
        MapManager.map.setView([pos.lat, pos.lng], 16, { animate: true });
      } catch (e) {
        this.showToast(e.message);
      }
    });

    document.getElementById('btn-panel-menu').addEventListener('click', () => {
      this._openSheet('sheet-menu');
    });

    document.querySelectorAll('.trip-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = btn.dataset.trip;
        this.tripType = type;
        Storage.setTripType(type);
        this._updateTripUI();
        this._updateMapMarkers();
        this._closeSheet('sheet-trip');
      });
    });

    document.getElementById('trip-close').addEventListener('click', () => {
      this._closeSheet('sheet-trip');
    });
  },

  _updateTripUI() {
    const lbl = document.getElementById('lbl-trip');
    const opts = document.querySelectorAll('.trip-opt');
    opts.forEach(opt => opt.querySelector('.opt-check').classList.add('hidden'));

    let name = '';
    if (this.tripType === 'gchu_cdu') name = 'Gualeguaychú ➔ Concepción';
    if (this.tripType === 'cdu_gchu') name = 'Concepción ➔ Gualeguaychú';
    if (this.tripType === 'gchu_gchu') name = 'Solo Gualeguaychú';
    if (this.tripType === 'cdu_cdu') name = 'Solo Concepción';

    lbl.textContent = name;
    const activeOpt = document.querySelector(`.trip-opt[data-trip="${this.tripType}"]`);
    if (activeOpt) activeOpt.querySelector('.opt-check').classList.remove('hidden');

    // Default map center
    if (this.tripType.startsWith('cdu')) MapManager.setCity('concepcion');
    else MapManager.setCity('gualeguaychu');
  },

  // ═══════════════════════════════════════
  //  BOTTOM PANEL (Swipe / Tap)
  // ═══════════════════════════════════════

  _setupBottomPanel() {
    const panel = document.getElementById('bottom-panel');
    const handle = document.getElementById('panel-handle');
    const summary = document.getElementById('panel-summary');

    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let hasDragged = false;
    let initialHeight = 0;

    const togglePanel = () => {
      if (hasDragged) return;
      if (panel.classList.contains('minimized')) {
        panel.classList.remove('minimized');
      } else {
        panel.classList.add('minimized');
      }
      panel.classList.remove('expanded');
    };

    handle.addEventListener('click', togglePanel);
    summary.addEventListener('click', (e) => {
      if (e.target.id !== 'btn-panel-menu') togglePanel();
    });

    const endDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      panel.style.transition = 'max-height 0.35s cubic-bezier(0.32, 0.72, 0, 1), transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
      panel.style.maxHeight = '';
      panel.style.transform = '';

      const delta = startY - currentY;
      
      if (panel.classList.contains('minimized')) {
        if (delta > 20) {
          panel.classList.remove('minimized');
        }
      } else {
        if (delta < -20) {
          panel.classList.add('minimized');
          panel.classList.remove('expanded');
        } else if (delta > 50) {
          panel.classList.add('expanded');
        }
      }
    };

    const setupDrag = (el) => {
      el.addEventListener('pointerdown', (e) => {
        // Ignorar si se toca el botón del menú
        if (e.target.id === 'btn-panel-menu') return;
        
        startY = e.clientY;
        currentY = e.clientY;
        isDragging = true;
        hasDragged = false;
        panel.style.transition = 'none';
        initialHeight = panel.offsetHeight;
        e.target.setPointerCapture(e.pointerId);
      });

      el.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        currentY = e.clientY;
        const delta = startY - currentY;
        if (Math.abs(delta) > 10) hasDragged = true;
        
        if (panel.classList.contains('minimized')) {
          if (delta > 0) {
            panel.style.transform = `translateX(-50%) translateY(calc(100% - 35px - ${delta}px))`;
          }
        } else {
          let newHeight = initialHeight + delta;
          const minHeight = 130;
          const maxHeight = window.innerHeight * 0.75;
          
          if (newHeight > maxHeight) {
            newHeight = maxHeight + (newHeight - maxHeight) * 0.2;
            panel.style.maxHeight = `${newHeight}px`;
            panel.style.transform = `translateX(-50%)`;
          } else if (newHeight < minHeight) {
            const pullDown = minHeight - newHeight;
            panel.style.maxHeight = `${minHeight}px`;
            panel.style.transform = `translateX(-50%) translateY(${pullDown}px)`;
          } else {
            panel.style.maxHeight = `${newHeight}px`;
            panel.style.transform = `translateX(-50%)`;
          }
        }
      });

      el.addEventListener('pointerup', endDrag);
      el.addEventListener('pointercancel', endDrag);
    };

    setupDrag(handle);
    setupDrag(summary);

    // Action buttons in panel
    document.getElementById('btn-add-stop').addEventListener('click', () => {
      this._openSheet('sheet-passenger');
    });
  },

  // ═══════════════════════════════════════
  //  SHEETS
  // ═══════════════════════════════════════

  _setupSheets() {
    document.getElementById('opt-settings').addEventListener('click', () => {
      this._closeSheet('sheet-menu');
      this._openSheet('sheet-settings');
      this._updateSettingsUI();
    });

    document.getElementById('opt-new-route').addEventListener('click', () => {
      this._closeSheet('sheet-menu');
      if (confirm('¿Borrar todas las paradas y empezar de nuevo?')) {
        this._clearAll();
      }
    });

    // Add Passenger Sheet
    document.getElementById('btn-close-passenger').addEventListener('click', () => {
      this._closeSheet('sheet-passenger');
    });

    document.getElementById('btn-save-passenger').addEventListener('click', () => {
      if (!this.tempPassenger || !this.tempPassenger.origin || !this.tempPassenger.dest) {
        this.showToast('Debes seleccionar origen y destino');
        return;
      }

      const isOriginCdu = this.tempPassenger.origin.lat > -32.7;
      const isDestCdu = this.tempPassenger.dest.lat > -32.7;
      
      if (this.tripType === 'gchu_cdu') {
        if (isOriginCdu || !isDestCdu) {
          this.showToast('En este viaje, el origen debe ser Gualeguaychú y el destino Concepción');
          return;
        }
      } else if (this.tripType === 'cdu_gchu') {
        if (!isOriginCdu || isDestCdu) {
          this.showToast('En este viaje, el origen debe ser Concepción y el destino Gualeguaychú');
          return;
        }
      } else {
        if (isOriginCdu === isDestCdu) {
          this.showToast('El origen y destino deben ser en ciudades distintas');
          return;
        }
      }

      const name = document.getElementById('pass-name').value.trim() || 'Pasajero';
      const passId = 'pass_' + Date.now();
      
      this._addStop(this.tempPassenger.origin.lat, this.tempPassenger.origin.lng, this.tempPassenger.origin.address, isOriginCdu ? 'concepcion' : 'gualeguaychu', true, name, passId);
      this._addStop(this.tempPassenger.dest.lat, this.tempPassenger.dest.lng, this.tempPassenger.dest.address, isDestCdu ? 'concepcion' : 'gualeguaychu', false, name, passId);
      
      this.tempPassenger = { origin: null, dest: null };
      document.getElementById('pass-name').value = '';
      document.getElementById('lbl-pass-origin').textContent = 'Toca para elegir el origen...';
      document.getElementById('lbl-pass-origin').style.color = 'var(--text-dim)';
      document.getElementById('lbl-pass-dest').textContent = 'Toca para elegir el destino...';
      document.getElementById('lbl-pass-dest').style.color = 'var(--text-dim)';
      this._closeSheet('sheet-passenger');
    });

    // Edit Stop Sheet
    document.getElementById('edit-stop-close').addEventListener('click', () => {
      this._closeSheet('sheet-edit-stop');
    });
    
    document.getElementById('btn-save-stop').addEventListener('click', () => {
      if (this._editStopId) {
        const val = document.getElementById('edit-stop-name').value.trim();
        if (val) {
          const stop = this.stops.find(s => s.id === this._editStopId);
          if (stop) {
            stop.name = val;
            Storage.setStops(this.stops);
            this._updateUI();
            this._updateMapMarkers();
          }
        }
        this._closeSheet('sheet-edit-stop');
      }
    });

    document.getElementById('btn-delete-stop').addEventListener('click', () => {
      if (this._editStopId) {
        this.deleteStop(this._editStopId);
        this._closeSheet('sheet-edit-stop');
      }
    });

    // Old sheet-add listeners removed

    // Close buttons and backdrops
    document.querySelectorAll('.sheet-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sheet = e.target.closest('.sheet-backdrop');
        if (sheet) this._closeSheet(sheet.id);
      });
    });
    document.querySelectorAll('.sheet-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this._closeSheet(backdrop.id);
      });
    });
  },

  _setCity(city) {
    this.city = city;
    Storage.setCity(city);
    MapManager.setCity(city);
    this._updateMenuCheckmarks();
    this._closeSheet('sheet-menu');
  },

  _updateMenuCheckmarks() {
    document.getElementById('check-gchu').classList.toggle('hidden', this.city !== 'gualeguaychu');
    document.getElementById('check-cdu').classList.toggle('hidden', this.city !== 'concepcion');
  },

  _openSheet(id) {
    document.getElementById(id).classList.remove('hidden');
  },

  _closeSheet(id) {
    document.getElementById(id).classList.add('hidden');
  },

  // ═══════════════════════════════════════
  //  SETTINGS SHEET (Bases Fijas)
  // ═══════════════════════════════════════

  _settingMode: null, // 'gchu' | 'cdu' | null

  _setupSettingsSheet() {
    // Search address for Gchu base
    document.getElementById('btn-set-gchu').addEventListener('click', () => {
      this._settingMode = 'gchu';
      this._closeSheet('sheet-settings');
      setTimeout(() => this._openSheet('sheet-search'), 300);
      this._setSearchTab('gualeguaychu');
      document.getElementById('search-input').placeholder = 'Buscar base en Gchu…';
      document.getElementById('search-input').focus();
    });

    // Tap map for Gchu base
    const btnMapGchu = document.getElementById('btn-map-gchu');
    if (btnMapGchu) {
      btnMapGchu.addEventListener('click', () => {
        this._settingMode = 'gchu';
        this._closeSheet('sheet-settings');
        this._enterTapMode('gualeguaychu');
      });
    }

    // Search address for Cdu base
    document.getElementById('btn-set-cdu').addEventListener('click', () => {
      this._settingMode = 'cdu';
      this._closeSheet('sheet-settings');
      setTimeout(() => this._openSheet('sheet-search'), 300);
      this._setSearchTab('concepcion');
      document.getElementById('search-input').placeholder = 'Buscar base en Cdu…';
      document.getElementById('search-input').focus();
    });

    // Tap map for Cdu base
    const btnMapCdu = document.getElementById('btn-map-cdu');
    if (btnMapCdu) {
      btnMapCdu.addEventListener('click', () => {
        this._settingMode = 'cdu';
        this._closeSheet('sheet-settings');
        this._enterTapMode('concepcion');
      });
    }

    // Emote chips selector
    document.querySelectorAll('.emote-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const city = chip.dataset.city;
        const emote = chip.dataset.emote;
        Storage.setBaseEmote(city, emote);
        this._updateSettingsUI();
        this._updateMapMarkers();
        this.showToast(`Icono cambiado: ${emote}`);
      });
    });

    document.getElementById('btn-clear-gchu').addEventListener('click', () => {
      Storage.setBaseGchu(null);
      this._updateSettingsUI();
      this._updateMapMarkers();
      this.showToast('Base de Gualeguaychú borrada');
    });

    document.getElementById('btn-clear-cdu').addEventListener('click', () => {
      Storage.setBaseCdu(null);
      this._updateSettingsUI();
      this._updateMapMarkers();
      this.showToast('Base de Concepción borrada');
    });

    document.getElementById('settings-close').addEventListener('click', () => {
      this._closeSheet('sheet-settings');
    });
  },

  openSettingsSheet() {
    this._openSheet('sheet-settings');
    this._updateSettingsUI();
  },

  _updateSettingsUI() {
    const bgchu = Storage.getBaseGchu();
    const bcdu = Storage.getBaseCdu();
    const emoteGchu = Storage.getBaseEmote('gchu');
    const emoteCdu = Storage.getBaseEmote('cdu');

    const badgeGchu = document.getElementById('badge-base-gchu-emote');
    if (badgeGchu) badgeGchu.textContent = emoteGchu;
    const badgeCdu = document.getElementById('badge-base-cdu-emote');
    if (badgeCdu) badgeCdu.textContent = emoteCdu;

    // Highlight active emote chips
    document.querySelectorAll('.emote-chip[data-city="gchu"]').forEach(c => {
      c.classList.toggle('active', c.dataset.emote === emoteGchu);
    });
    document.querySelectorAll('.emote-chip[data-city="cdu"]').forEach(c => {
      c.classList.toggle('active', c.dataset.emote === emoteCdu);
    });

    const lblGchu = document.getElementById('lbl-base-gchu');
    const btnClearGchu = document.getElementById('btn-clear-gchu');
    if (bgchu) {
      lblGchu.textContent = bgchu.address;
      lblGchu.style.color = 'var(--text)';
      btnClearGchu.classList.remove('hidden');
    } else {
      lblGchu.textContent = 'No configurada';
      lblGchu.style.color = 'var(--text-dim)';
      btnClearGchu.classList.add('hidden');
    }

    const lblCdu = document.getElementById('lbl-base-cdu');
    const btnClearCdu = document.getElementById('btn-clear-cdu');
    if (bcdu) {
      lblCdu.textContent = bcdu.address;
      lblCdu.style.color = 'var(--text)';
      btnClearCdu.classList.remove('hidden');
    } else {
      lblCdu.textContent = 'No configurada';
      lblCdu.style.color = 'var(--text-dim)';
      btnClearCdu.classList.add('hidden');
    }
  },

  // ═══════════════════════════════════════
  //  SEARCH SHEET
  // ═══════════════════════════════════════

  _setupSearchSheet() {
    const input = document.getElementById('search-input');
    const clear = document.getElementById('search-clear');
    const hint = document.getElementById('search-hint');
    const results = document.getElementById('search-results');

    // Search Tabs
    const tabs = document.querySelectorAll('.search-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this._setSearchTab(tab.dataset.city);
        if (input.value.length >= 3) this._doSearch(input.value);
      });
    });

    // Default search city based on trip type if none selected
    if (this.tripType.startsWith('cdu')) this.searchCity = 'concepcion';
    else this.searchCity = 'gualeguaychu';
    this._setSearchTab(this.searchCity);

    input.addEventListener('input', () => {
      const val = input.value.trim();
      clear.classList.toggle('hidden', val.length === 0);

      clearTimeout(this.searchTimer);
      if (val.length < 3) {
        results.innerHTML = '';
        hint.classList.add('hidden');
        return;
      }
      
      hint.textContent = 'Buscando…';
      hint.classList.remove('hidden');
      results.innerHTML = '';

      this.searchTimer = setTimeout(() => this._doSearch(val), 800);
    });

    clear.addEventListener('click', () => {
      input.value = '';
      clear.classList.add('hidden');
      results.innerHTML = '';
      hint.classList.add('hidden');
      input.focus();
    });
  },

  _setSearchTab(city) {
    this.searchCity = city;
    document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
    const t = document.querySelector(`.search-tab[data-city="${city}"]`);
    if (t) t.classList.add('active');
  },

  async _doSearch(query) {
    const hint = document.getElementById('search-hint');
    const resultsContainer = document.getElementById('search-results');

    try {
      const results = await Geocoder.search(query, this.searchCity);
      
      if (results.length === 0) {
        hint.textContent = 'No se encontraron resultados';
        hint.classList.remove('hidden');
        resultsContainer.innerHTML = '';
        return;
      }

      hint.classList.add('hidden');
      this._searchResults = results;

      resultsContainer.innerHTML = results.map((r, i) =>
        `<div class="search-result-item" onclick="App._selectSearchResult(${i})">
          <div style="font-weight:600; margin-bottom:2px;">${r.label || r.displayName}</div>
          <div style="font-size:13px; color:var(--text-dim);">${r.displayName}</div>
        </div>`
      ).join('');
    } catch (e) {
      hint.textContent = 'Error buscando dirección';
      hint.classList.remove('hidden');
    }
  },

  _selectSearchResult(index) {
    const r = this._searchResults[index];
    if (!r) return;
    
    const address = r.label || r.displayName;
    
    if (this._settingMode) {
      const isCdu = r.lat > -32.7;
      if (this._settingMode === 'gchu' && isCdu) {
        this.showToast('La Base Gualeguaychú debe estar en Gualeguaychú');
        return;
      }
      if (this._settingMode === 'cdu' && !isCdu) {
        this.showToast('La Base Concepción debe estar en Concepción');
        return;
      }

      const point = { lat: r.lat, lng: r.lng, address: address };
      if (this._settingMode === 'gchu') Storage.setBaseGchu(point);
      else Storage.setBaseCdu(point);
      
      this._settingMode = null;
      document.getElementById('search-input').placeholder = 'Buscar dirección…';
      this._closeSheet('sheet-search');
      this._updateMapMarkers();
      setTimeout(() => {
        this._openSheet('sheet-settings');
        this._updateSettingsUI();
      }, 300);
      this.showToast('Base actualizada');
    } else if (this.pickerMode) {
      const point = { lat: r.lat, lng: r.lng, address: address };
      if (!this.tempPassenger) this.tempPassenger = { origin: null, dest: null };
      
      if (this.pickerMode === 'origin') {
        this.tempPassenger.origin = point;
        document.getElementById('lbl-pass-origin').textContent = address;
        document.getElementById('lbl-pass-origin').style.color = 'var(--text)';
      } else {
        this.tempPassenger.dest = point;
        document.getElementById('lbl-pass-dest').textContent = address;
        document.getElementById('lbl-pass-dest').style.color = 'var(--text)';
      }
      this.pickerMode = null;
      document.getElementById('search-input').placeholder = 'Buscar dirección…';
      this._closeSheet('sheet-search');
      setTimeout(() => this._openSheet('sheet-passenger'), 300);
    } else {
      this._addStop(r.lat, r.lng, address, this.searchCity, null, 'Parada Extra');
      this._closeSheet('sheet-search');
    }

    // Reset search
    document.getElementById('search-input').value = '';
    document.getElementById('search-clear').classList.add('hidden');
    document.getElementById('search-results').innerHTML = '';
  },

  // ═══════════════════════════════════════
  //  GMAPS SHEET
  // ═══════════════════════════════════════

  _setupGmapsSheet() {
    document.getElementById('gmaps-add').addEventListener('click', async () => {
      const input = document.getElementById('gmaps-input');
      const val = input.value.trim();
      const errorEl = document.getElementById('gmaps-error');
      errorEl.classList.add('hidden');

      if (!val) {
        errorEl.textContent = 'Ingresá un enlace válido.';
        errorEl.classList.remove('hidden');
        return;
      }

      const coords = this._parseGmaps(val);
      if (!coords) {
        errorEl.textContent = 'No se encontraron coordenadas en el enlace.';
        errorEl.classList.remove('hidden');
        return;
      }

      this._closeSheet('sheet-gmaps');
      this.showLoading('Obteniendo dirección…');

      let address = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      try {
        const geo = await Geocoder.reverse(coords.lat, coords.lng);
        address = geo.label || geo.displayName || address;
      } catch (e) {}
      this.hideLoading();

      if (this.pickerMode) {
        const point = { lat: coords.lat, lng: coords.lng, address: address };
        if (!this.tempPassenger) this.tempPassenger = { origin: null, dest: null };
        
        if (this.pickerMode === 'origin') {
          this.tempPassenger.origin = point;
          document.getElementById('lbl-pass-origin').textContent = address;
          document.getElementById('lbl-pass-origin').style.color = 'var(--text)';
        } else {
          this.tempPassenger.dest = point;
          document.getElementById('lbl-pass-dest').textContent = address;
          document.getElementById('lbl-pass-dest').style.color = 'var(--text)';
        }
        this.pickerMode = null;
        input.value = '';
        setTimeout(() => this._openSheet('sheet-passenger'), 300);
      } else {
        this._addStop(coords.lat, coords.lng, address);
        input.value = '';
      }
    });
  },

  _parseGmaps(url) {
    let m;
    m = url.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/\/place\/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    return null;
  },

  // ═══════════════════════════════════════
  //  TAP MODE
  // ═══════════════════════════════════════

  _tapHandler: null,

  _setupTapMode() {
    document.getElementById('tap-cancel').addEventListener('click', () => this._exitTapMode());
    document.getElementById('tap-yes').addEventListener('click', () => {
      if (this.pendingTap) {
        if (this._settingMode) {
          const isCdu = this.pendingTap.lat > -32.7;
          if (this._settingMode === 'gchu' && isCdu) {
            this.showToast('La Base Gualeguaychú debe estar en Gualeguaychú');
            return;
          }
          if (this._settingMode === 'cdu' && !isCdu) {
            this.showToast('La Base Concepción debe estar en Concepción');
            return;
          }

          const point = { lat: this.pendingTap.lat, lng: this.pendingTap.lng, address: this.pendingTap.address };
          if (this._settingMode === 'gchu') Storage.setBaseGchu(point);
          else Storage.setBaseCdu(point);
          
          this._settingMode = null;
          this._exitTapMode();
          this._updateMapMarkers();
          setTimeout(() => {
            this._openSheet('sheet-settings');
            this._updateSettingsUI();
          }, 300);
          this.showToast('Base guardada en el mapa');
          return;
        }

        if (this.pickerMode) {
          const point = { lat: this.pendingTap.lat, lng: this.pendingTap.lng, address: this.pendingTap.address };
          if (!this.tempPassenger) this.tempPassenger = { origin: null, dest: null };
          
          if (this.pickerMode === 'origin') {
            this.tempPassenger.origin = point;
            document.getElementById('lbl-pass-origin').textContent = point.address;
            document.getElementById('lbl-pass-origin').style.color = 'var(--text)';
          } else {
            this.tempPassenger.dest = point;
            document.getElementById('lbl-pass-dest').textContent = point.address;
            document.getElementById('lbl-pass-dest').style.color = 'var(--text)';
          }
          this.pickerMode = null;
          this._exitTapMode();
          setTimeout(() => this._openSheet('sheet-passenger'), 300);
        } else {
          this._addStop(this.pendingTap.lat, this.pendingTap.lng, this.pendingTap.address);
          this._exitTapMode();
        }
      }
    });
    document.getElementById('tap-no').addEventListener('click', () => {
      MapManager.clearTempMarker();
      document.getElementById('tap-confirm').classList.add('hidden');
      this.pendingTap = null;
    });
  },

  _enterTapMode(targetCity = null) {
    this.tapMode = true;
    document.getElementById('tap-bar').classList.remove('hidden');
    document.getElementById('bottom-panel').classList.add('hidden');
    
    if (targetCity) {
      MapManager.setCity(targetCity);
    }

    // Hide floating buttons
    document.querySelectorAll('.float-circle').forEach(b => b.classList.add('hidden'));

    this._tapHandler = async (e) => {
      const { lat, lng } = e.latlng;
      MapManager.setTempMarker(lat, lng);
      
      const confirmCard = document.getElementById('tap-confirm');
      const addrEl = document.getElementById('tap-address');
      
      addrEl.textContent = 'Buscando…';
      confirmCard.classList.remove('hidden');

      try {
        const geo = await Geocoder.reverse(lat, lng);
        this.pendingTap = { lat, lng, address: geo.label || geo.displayName };
        addrEl.textContent = this.pendingTap.address;
      } catch (err) {
        this.pendingTap = { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
        addrEl.textContent = this.pendingTap.address;
      }
    };

    MapManager.map.on('click', this._tapHandler);
  },

  _exitTapMode() {
    this.tapMode = false;
    this.pendingTap = null;
    MapManager.clearTempMarker();
    
    document.getElementById('tap-bar').classList.add('hidden');
    document.getElementById('tap-confirm').classList.add('hidden');
    document.getElementById('bottom-panel').classList.remove('hidden');
    document.querySelectorAll('.float-circle').forEach(b => b.classList.remove('hidden'));

    if (this._tapHandler) {
      MapManager.map.off('click', this._tapHandler);
      this._tapHandler = null;
    }
  },

  // ═══════════════════════════════════════
  //  STOP MANAGEMENT & UI
  // ═══════════════════════════════════════

  pickAddress(type, method) {
    this.pickerMode = type;
    this._closeSheet('sheet-passenger');
    
    let targetCity = null;
    if (this.tripType === 'gchu_cdu') targetCity = type === 'origin' ? 'gualeguaychu' : 'concepcion';
    else if (this.tripType === 'cdu_gchu') targetCity = type === 'origin' ? 'concepcion' : 'gualeguaychu';
    else if (this.tripType === 'gchu_gchu') targetCity = 'gualeguaychu';
    else if (this.tripType === 'cdu_cdu') targetCity = 'concepcion';

    if (method === 'map') {
      this._enterTapMode(targetCity);
    } else if (method === 'search') {
      setTimeout(() => {
        this._openSheet('sheet-search');
        if (targetCity) this._setSearchTab(targetCity);
        document.getElementById('search-input').focus();
      }, 300);
    } else if (method === 'gmaps') {
      setTimeout(() => {
        this._openSheet('sheet-gmaps');
        document.getElementById('gmaps-input').focus();
      }, 300);
    }
  },

  _addStop(lat, lng, address, cityCode = null, isOrigin = null, name = 'Pasajero', passId = null) {
    let c = cityCode;
    // Guess city from coords if not provided
    if (!c) {
      if (lat > -32.7) c = 'concepcion';
      else c = 'gualeguaychu';
    }
    
    const stop = {
      id: passId ? passId + (isOrigin ? '_org' : '_dst') : 'stop_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      lat, lng, address,
      isOrigin,
      passId,
      name,
      cityStr: name + (isOrigin ? ' (Subida)' : (isOrigin === false ? ' (Bajada)' : ''))
    };
    this.stops.push(stop);
    this.routeCalculated = false;
    this.currentRoute = null;
    this.currentWaypoints = null;
    
    Storage.setStops(this.stops);
    this._updateMapMarkers();
    MapManager.openPopup(stop.id);
    this._updateUI();
  },

  deleteStop(id) {
    MapManager.map.closePopup();
    this.stops = this.stops.filter(s => s.id !== id);
    this.doneStops.delete(id);
    this.routeCalculated = false;
    this.currentRoute = null;
    this.currentWaypoints = null;
    
    Storage.setStops(this.stops);
    if (this.stops.length === 0) MapManager.clearRoute();
    this._updateMapMarkers();
    this._updateUI();
  },

  editStopName(id) {
    MapManager.map.closePopup();
    const stop = this.stops.find(s => s.id === id);
    if (!stop) return;
    
    // Instead of prompt, we use the sheet
    this._editStopId = id;
    let currentName = stop.name;
    if (!currentName || currentName === 'Pasajero') {
        if (stop.cityStr) currentName = stop.cityStr.split(' (')[0];
    }
    if (currentName === 'Pasajero') currentName = '';
    
    document.getElementById('edit-stop-name').value = currentName;
    this._openSheet('sheet-edit-stop');
    setTimeout(() => document.getElementById('edit-stop-name').focus(), 300);
  },

  toggleDone(id) {
    if (this.doneStops.has(id)) {
      this.doneStops.delete(id);
    } else {
      this.doneStops.add(id);
    }
    
    if (this.routeCalculated && this.currentRoute && this.currentWaypoints) {
      MapManager.drawRoute(this.currentRoute, this.currentWaypoints, this.doneStops);
    }
    
    this._updateMapMarkers();
    this._updateUI();
  },

  setActiveStop(id) {
    this.activeStopId = id;
    this._updateUI();
    MapManager.openPopup(id);
  },

  navigateTo(idOrLat, lng) {
    if (lng !== undefined) {
      // It's a coordinate (base marker)
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${idOrLat},${lng}&travelmode=driving`, '_blank');
      return;
    }
    const s = this.stops.find(x => x.id === idOrLat);
    if (!s) return;
    const query = this._getGoogleMapsNavQuery(s);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`, '_blank');
  },

  navigateFullRoute() {
    // Only navigate pending stops
    const pendingStops = this.stops.filter(s => !this.doneStops.has(s.id));
    if (pendingStops.length === 0) {
      this.showToast('No hay paradas pendientes');
      return;
    }
    
    // Check if we have bases
    const bGchu = Storage.getBaseGchu();
    const bCdu = Storage.getBaseCdu();
    let startPoint = null;
    let endPoint = null;
    if (this.tripType === 'gchu_cdu') { startPoint = bGchu; endPoint = bCdu; }
    else if (this.tripType === 'cdu_gchu') { startPoint = bCdu; endPoint = bGchu; }
    else if (this.tripType === 'gchu_gchu') { startPoint = bGchu; endPoint = bGchu; }
    else if (this.tripType === 'cdu_cdu') { startPoint = bCdu; endPoint = bCdu; }

    const allPoints = [];
    if (startPoint) allPoints.push(startPoint);
    allPoints.push(...pendingStops);
    if (endPoint) allPoints.push(endPoint);

    if (allPoints.length < 2) return;

    // Use maps/dir/A/B/C format to strictly enforce order and stop-by-stop navigation
    const pathSegments = allPoints.map(p => this._getGoogleMapsNavQuery(p)).join('/');
    const url = `https://www.google.com/maps/dir/${pathSegments}/?travelmode=driving`;
    
    window.open(url, '_blank');
  },

  navigateCityRoute(city) {
    const pendingStops = this.stops.filter(s => {
      if (this.doneStops.has(s.id)) return false;
      const sCity = s.lat > -32.7 ? 'Concepción' : 'Gualeguaychú';
      return sCity === city;
    });

    if (pendingStops.length === 0) {
      this.showToast(`No hay paradas pendientes en ${city}`);
      return;
    }

    if (pendingStops.length === 1) {
      this.navigateTo(pendingStops[0].id);
      return;
    }

    const pathSegments = pendingStops.map(p => this._getGoogleMapsNavQuery(p)).join('/');
    const url = `https://www.google.com/maps/dir/${pathSegments}/?travelmode=driving`;
    window.open(url, '_blank');
  },

  _getGoogleMapsNavQuery(p) {
    // Si la dirección es genérica o marcada en el mapa, usamos coordenadas para no confundir a Google
    if (!p.address || p.address === 'Ubicación' || p.address === 'Punto marcado en el mapa') {
      return `${p.lat},${p.lng}`;
    }
    const cityName = p.lat > -32.7 ? 'Concepción del Uruguay' : 'Gualeguaychú';
    return encodeURIComponent(`${p.address}, ${cityName}, Entre Ríos`);
  },

  _clearAll() {
    this.stops = [];
    this.doneStops.clear();
    this.routeCalculated = false;
    Storage.clearRoute();
    MapManager.clearRoute();
    this._updateMapMarkers();
    this._updateUI();
    this.showToast('Ruta reiniciada');
  },

  _updateMapMarkers() {
    const bGchu = Storage.getBaseGchu();
    const bCdu = Storage.getBaseCdu();
    const bases = [];

    if (bGchu) {
      let role = 'base';
      let roleName = 'Base Gchu';
      if (this.tripType === 'gchu_cdu') { role = 'start'; roleName = 'Base Gchu (Salida)'; }
      else if (this.tripType === 'cdu_gchu') { role = 'end'; roleName = 'Base Gchu (Llegada)'; }
      
      const point = {
        lat: parseFloat(bGchu.lat) || -33.0089,
        lng: parseFloat(bGchu.lng) || -58.5147,
        address: bGchu.address || 'Base Gualeguaychú'
      };

      bases.push({
        type: 'gchu',
        name: roleName,
        point: point,
        emote: Storage.getBaseEmote('gchu') || '🏢',
        role: role
      });
    }

    if (bCdu) {
      let role = 'base';
      let roleName = 'Base Cdu';
      if (this.tripType === 'gchu_cdu') { role = 'end'; roleName = 'Base Cdu (Llegada)'; }
      else if (this.tripType === 'cdu_gchu') { role = 'start'; roleName = 'Base Cdu (Salida)'; }

      const point = {
        lat: parseFloat(bCdu.lat) || -32.4828,
        lng: parseFloat(bCdu.lng) || -58.2335,
        address: bCdu.address || 'Base Concepción'
      };

      bases.push({
        type: 'cdu',
        name: roleName,
        point: point,
        emote: Storage.getBaseEmote('cdu') || '🏢',
        role: role
      });
    }

    MapManager.updateAllMarkers(this.stops, this.routeCalculated, this.doneStops, bases);
  },

  // ═══════════════════════════════════════
  //  ROUTING
  // ═══════════════════════════════════════

  async _calculateRoute() {
    if (this.stops.length < 2) return;

    this.showLoading('Optimizando recorrido…');

    try {
      let waypoints = this.stops.map(s => ({ lat: s.lat, lng: s.lng, isFixed: false }));
      
      const bGchu = Storage.getBaseGchu();
      const bCdu = Storage.getBaseCdu();
      
      let startPoint = null;
      let endPoint = null;

      if (this.tripType === 'gchu_cdu') { startPoint = bGchu; endPoint = bCdu; }
      else if (this.tripType === 'cdu_gchu') { startPoint = bCdu; endPoint = bGchu; }
      else if (this.tripType === 'gchu_gchu') { startPoint = bGchu; endPoint = bGchu; }
      else if (this.tripType === 'cdu_cdu') { startPoint = bCdu; endPoint = bCdu; }

      let offsetStart = 0;
      let offsetEnd = 0;
      let fixedStartIndex = null;
      let fixedEndIndex = null;

      // Add start point if exists
      if (startPoint) {
        waypoints.unshift({ lat: startPoint.lat, lng: startPoint.lng, isFixed: true, address: startPoint.address, id: 'fixed_start' });
        offsetStart = 1;
        fixedStartIndex = 0;
      }

      // Add end point if exists
      if (endPoint) {
        waypoints.push({ lat: endPoint.lat, lng: endPoint.lng, isFixed: true, address: endPoint.address, id: 'fixed_end' });
        offsetEnd = 1;
        fixedEndIndex = waypoints.length - 1;
      }

      const matrix = await Router.getDistanceMatrix(waypoints);
      const order = Optimizer.optimize(matrix.durations, fixedStartIndex, fixedEndIndex); 
      
      const newStops = [];
      const orderedWaypoints = [];
      
      for (const i of order) {
        orderedWaypoints.push(waypoints[i]);
        if (!waypoints[i].isFixed) {
          // It's a real stop, map it back correctly. 
          // index in this.stops is (i - offsetStart) only if we keep track.
          // Better approach: match by lat/lng or just know that intermediate nodes are original stops.
          const originalIndex = i - offsetStart;
          newStops.push(this.stops[originalIndex]);
        }
      }
      
      this.stops = newStops;
      Storage.setStops(this.stops);
      
      this._calculateHues(); // Ensure this.stops has .hue properties

      // Assign hues back to orderedWaypoints
      let stopIdx = 0;
      for (let w of orderedWaypoints) {
        if (!w.isFixed) {
          w.hue = this.stops[stopIdx].hue;
          stopIdx++;
        }
      }

      const route = await Router.getRoute(orderedWaypoints);

      this.routeCalculated = true;
      this.currentRoute = route;
      this.currentWaypoints = orderedWaypoints;
      MapManager.drawRoute(route, orderedWaypoints, this.doneStops);
      
      // Update markers: we should probably show fixed start/end on map too?
      // For now, let's just keep showing the actual stops 1, 2, 3...
      this._updateMapMarkers();
      MapManager.fitAll();
      
      // Save route data for UI
      Storage.setRouteData({ distance: route.distance, duration: route.duration });
      this._updateUI();
      
      // Expand panel slightly to show route info
      const panel = document.getElementById('bottom-panel');
      if (!panel.classList.contains('expanded')) {
        panel.style.maxHeight = '50vh';
      }

    } catch (err) {
      console.error(err);
      this.showToast('Error al calcular la ruta');
    }
    this.hideLoading();
  },

  // ═══════════════════════════════════════
  //  UI UPDATES
  // ═══════════════════════════════════════

  _calculateHues() {
    const passHues = {};
    let hueCounter = 0;
    this.stops.forEach(s => {
      if (s.passId) {
        if (passHues[s.passId] === undefined) {
          passHues[s.passId] = (hueCounter * 137.5) % 360;
          hueCounter++;
        }
        s.hue = passHues[s.passId];
      } else {
        s.hue = (hueCounter * 137.5) % 360;
        hueCounter++;
      }
    });
  },

  _updateUI() {
    this._calculateHues();
    const stopsContainer = document.getElementById('panel-stops');
    const actionsContainer = document.getElementById('panel-actions');
    const statsEl = document.getElementById('summary-stats');
    const subEl = document.getElementById('summary-sub');

    // Stats
    const pendingCount = this.stops.length - this.doneStops.size;
    
    if (this.stops.length === 0) {
      statsEl.textContent = 'Sin paradas';
      subEl.textContent = 'Agregá tu primera parada';
      MapManager.clearRoute();
      this.routeCalculated = false;
    } else {
      statsEl.textContent = `${pendingCount} parada${pendingCount !== 1 ? 's' : ''} restante${pendingCount !== 1 ? 's' : ''}`;
      if (this.routeCalculated) {
        const routeData = Storage.getRouteData();
        if (routeData) {
          const eta = new Date(Date.now() + routeData.duration * 1000);
          const etaStr = eta.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          statsEl.textContent = `${Router.formatDistance(routeData.distance)} • ${Router.formatDuration(routeData.duration)} • ${etaStr}`;
          subEl.textContent = `${pendingCount} parada${pendingCount !== 1 ? 's' : ''} restante${pendingCount !== 1 ? 's' : ''}`;
        } else {
          statsEl.textContent = `${pendingCount} parada${pendingCount !== 1 ? 's' : ''} restante${pendingCount !== 1 ? 's' : ''}`;
          subEl.textContent = 'Ruta optimizada';
        }
        statsEl.style.color = 'var(--accent)';
      } else {
        statsEl.textContent = `${pendingCount} parada${pendingCount !== 1 ? 's' : ''} restante${pendingCount !== 1 ? 's' : ''}`;
        subEl.textContent = `${this.stops.length} en total (sin optimizar)`;
        statsEl.style.color = 'var(--text)';
        MapManager.clearRoute();
      }
    }

    const passHues = {};
    let hueCounter = 0;

    // Render Stops (Grouped by City)
    let stopsHTML = '';
    let currentCityGroup = null;

    this.stops.forEach((s, i) => {
      const isDone = this.doneStops.has(s.id);
      
      let pName = s.name;
      if (!pName && s.cityStr) pName = s.cityStr.split(' (')[0];
      pName = pName || 'Pasajero';
      
      const pCity = s.lat > -32.7 ? 'Concepción' : 'Gualeguaychú';
      const cityText = `${pName} (${pCity})`;

      if (pCity !== currentCityGroup) {
        stopsHTML += `
          <div class="city-divider">
            <span>${pCity}</span>
            ${this.routeCalculated ? `
            <button class="city-nav-btn" onclick="App.navigateCityRoute('${pCity}')" title="Navegar solo por ${pCity}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </button>
            ` : ''}
          </div>
        `;
        currentCityGroup = pCity;
      }

      const hue = s.hue;
      const colorStyle = !isDone ? `style="background: hsl(${hue}, 85%, 45%); border-color: hsl(${hue}, 85%, 45%);"` : '';
      
      const markerName = s.name || (s.cityStr ? s.cityStr.split(' ')[0] : null);
      const markerText = markerName ? markerName.charAt(0).toUpperCase() : (i + 1);
      
      let isActive = false;
      if (this.activeStopId) {
        isActive = (s.id === this.activeStopId);
      } else {
        // Fallback to first undone stop if nothing is actively selected
        if (!isDone) {
          // Check if it's the first undone stop by seeing if any previous stop is not done
          const isFirstUndone = this.stops.slice(0, i).every(prev => this.doneStops.has(prev.id));
          isActive = isFirstUndone;
        }
      }
      
      stopsHTML += `
        <div class="stop-card ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}">
          <div class="stop-card-top">
            <div class="marker-num" ${colorStyle}>${isDone ? '✓' : markerText}</div>
            <div class="stop-content" onclick="App.setActiveStop('${s.id}')">
              <div class="stop-addr">${this._esc(s.address)}</div>
              <div class="stop-city">${cityText}</div>
            </div>
            <div class="stop-edit-btn" onclick="App.editStopName('${s.id}')">✏️</div>
          </div>
          ${!isDone ? `
          <div class="stop-card-actions">
            <button class="stop-btn stop-btn-nav" onclick="event.stopPropagation(); App.navigateTo('${s.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> Nav
            </button>
            <button class="stop-btn stop-btn-done" onclick="event.stopPropagation(); App.toggleDone('${s.id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Hecho
            </button>
          </div>
          ` : `
          <div class="stop-card-actions" style="margin-top:8px; padding-top:0; border-top:none;">
             <button class="stop-btn stop-btn-more" style="width:100%; justify-content:center;" onclick="event.stopPropagation(); App.toggleDone('${s.id}')">Deshacer</button>
          </div>
          `}
        </div>
      `;
    });
    stopsContainer.innerHTML = stopsHTML;

    // Actions button
    if (this.stops.length >= 2) {
      if (this.routeCalculated) {
        actionsContainer.innerHTML = `
          <button id="btn-nav-full" class="btn-primary" style="margin-top:12px; background:#4285F4; color:white; border:none; box-shadow: 0 4px 12px rgba(66, 133, 244, 0.4);">
            🚗 Navegar todo en Google Maps
          </button>
          <button id="btn-add-secondary" class="btn-add-stop" style="margin-top:8px; background:var(--surface-3); border:none;">
            Agregar otro pasajero
          </button>
        `;
        document.getElementById('btn-nav-full').addEventListener('click', () => this.navigateFullRoute());
        document.getElementById('btn-add-secondary').addEventListener('click', () => this._openSheet('sheet-passenger'));
      } else {
        actionsContainer.innerHTML = `
          <button id="btn-optimize-main" class="btn-optimize">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            Optimizar ruta
          </button>
          <button id="btn-add-secondary" class="btn-add-stop" style="margin-top:8px; background:var(--surface-3); border:none;">
            Agregar otro pasajero
          </button>
        `;
        document.getElementById('btn-optimize-main').addEventListener('click', () => this._calculateRoute());
        document.getElementById('btn-add-secondary').addEventListener('click', () => this._openSheet('sheet-passenger'));
      }
    } else {
      actionsContainer.innerHTML = `
        <button id="btn-add-main" class="btn-add-stop">
          <span class="add-icon">+</span> Agregar Pasajero
        </button>
      `;
      document.getElementById('btn-add-main').addEventListener('click', () => this._openSheet('sheet-passenger'));
    }
  },

  // ═══════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════

  showLoading(msg) {
    document.getElementById('loading-msg').textContent = msg || 'Cargando…';
    document.getElementById('loading').classList.remove('hidden');
  },

  hideLoading() {
    document.getElementById('loading').classList.add('hidden');
  },

  showToast(msg) {
    clearTimeout(this.toastTimer);
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    this.toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  },

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },
};

window.App = App;
window.onerror = function(msg, url, line, col, error) {
  alert("Error global: " + msg + "\nLínea: " + line + "\n" + (error ? error.stack : ""));
};
document.addEventListener('DOMContentLoaded', () => App.init());
