const supabaseUrl = 'https://adnqhlgxqwiyqzrmxoto.supabase.co';
const supabaseKey = 'sb_publishable_wb7mCKHecfm5AM4PtiQIfA_dr0_G3W_';
let supabaseClient = null;

const SYNC_ID = 'my_pap_state';

const SyncManager = {
  isSyncing: false,
  _debounceTimer: null,
  _lastPushedString: null,

  async init() {
    if (!window.supabase) return;
    
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

    // Initial fetch
    await this.pull();

    // Subscribe to realtime changes
    supabaseClient
      .channel('pap_state_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pap_state',
          filter: `id=eq.${SYNC_ID}`,
        },
        (payload) => {
          this.handleRemoteChange(payload.new);
        }
      )
      .subscribe();
  },

  push() {
    if (this.isSyncing || !supabaseClient) return;

    // Debounce to prevent spamming the database
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(async () => {
      // Gather all local storage data
      const data = {
        city: Storage.getCity(),
        stops: Storage.getStops(),
        baseGchu: Storage.getBaseGchu(),
        baseCdu: Storage.getBaseCdu(),
        baseEmoteGchu: Storage.getBaseEmote('gchu'),
        baseEmoteCdu: Storage.getBaseEmote('cdu'),
        tripType: Storage.getTripType(),
        routeData: Storage.getRouteData(),
        doneStops: Array.from(App.doneStops) // Include done state
      };
      
      this._lastPushedString = JSON.stringify(data);

      try {
        this.isSyncing = true;
        await supabaseClient.from('pap_state').upsert({
          id: SYNC_ID,
          data: data,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.error('Push error', e);
      } finally {
        this.isSyncing = false;
      }
    }, 1000); // 1s debounce
  },

  async pull() {
    if (!supabaseClient) return;
    try {
      this.isSyncing = true;
      const { data, error } = await supabaseClient
        .from('pap_state')
        .select('data')
        .eq('id', SYNC_ID)
        .single();
      
      if (data && data.data) {
        this._lastPushedString = JSON.stringify(data.data);
        this.applyData(data.data);
      }
    } catch (e) {
      console.error('Pull error', e);
    } finally {
      this.isSyncing = false;
    }
  },

  handleRemoteChange(newRow) {
    if (this.isSyncing) return;
    if (newRow && newRow.data) {
      if (JSON.stringify(newRow.data) === this._lastPushedString) return; // Ignore echo
      
      this.isSyncing = true;
      this._lastPushedString = JSON.stringify(newRow.data);
      this.applyData(newRow.data);
      this.isSyncing = false;
    }
  },

  applyData(data) {
    // Only update storage without triggering a push cycle (isSyncing is true)
    if (data.city) localStorage.setItem(Storage.KEYS.CITY, JSON.stringify(data.city));
    if (data.stops) localStorage.setItem(Storage.KEYS.STOPS, JSON.stringify(data.stops));
    if (data.baseGchu) localStorage.setItem(Storage.KEYS.BASE_GCHU, JSON.stringify(data.baseGchu));
    if (data.baseCdu) localStorage.setItem(Storage.KEYS.BASE_CDU, JSON.stringify(data.baseCdu));
    if (data.baseEmoteGchu) localStorage.setItem(Storage.KEYS.BASE_EMOTE_GCHU, JSON.stringify(data.baseEmoteGchu));
    if (data.baseEmoteCdu) localStorage.setItem(Storage.KEYS.BASE_EMOTE_CDU, JSON.stringify(data.baseEmoteCdu));
    if (data.tripType) localStorage.setItem(Storage.KEYS.TRIP_TYPE, JSON.stringify(data.tripType));
    if (data.routeData) localStorage.setItem(Storage.KEYS.ROUTE_DATA, JSON.stringify(data.routeData));
    
    // Update active memory
    App.tripType = data.tripType || 'gchu_cdu';
    App.stops = data.stops || [];
    
    if (data.doneStops) {
      App.doneStops = new Set(data.doneStops);
    }
    
    // Refresh app visuals
    App.routeCalculated = false; // By default we invalidate optimization unless we want to serialize it fully
    App.currentRoute = null;
    App.currentWaypoints = null;
    MapManager.clearRoute();
    
    App._updateTripUI();
    App._updateMapMarkers();
    App._updateUI();
    
    if (App.stops.length > 0) {
      MapManager.fitStops();
    }
  }
};

window.SyncManager = SyncManager;
