/* ===== Live Location Map Page ===== */

let _mapInstance = null;
let _mapPollTimer = null;
const _mapMarkers = {};

async function renderMap() {
  if (_mapPollTimer) { clearInterval(_mapPollTimer); _mapPollTimer = null; }

  mount(`
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Live Map</div>
          <div class="page-subtitle">Real-time locations of all active users</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <span id="map-update-status" style="font-size:13px;color:var(--text-muted)"></span>
          <button class="btn btn-primary btn-sm" id="btn-update-location">📍 Update My Location</button>
        </div>
      </div>

      <div id="map-container" style="height:520px;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border)"></div>

      <div class="section-heading" style="margin-top:24px">
        <span>Active Locations</span>
        <span id="map-count" style="color:var(--text-muted);font-size:13px"></span>
      </div>
      <div id="location-list" class="chip-list" style="margin-top:8px"></div>
    </div>
  `);

  /* Init Leaflet map */
  if (_mapInstance) {
    _mapInstance.remove();
    _mapInstance = null;
  }

  if (typeof L === 'undefined') {
    document.getElementById('map-container').innerHTML =
      '<div class="empty-state"><span class="empty-icon">🗺️</span>Map library not loaded. Check your internet connection.</div>';
    return;
  }

  _mapInstance = L.map('map-container').setView([34.05, -118.24], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(_mapInstance);

  await refreshMapLocations();

  /* Poll every 10 seconds */
  _mapPollTimer = setInterval(async () => {
    if (!document.getElementById('map-container')) {
      clearInterval(_mapPollTimer);
      return;
    }
    await refreshMapLocations();
  }, 10000);

  /* Update my location */
  document.getElementById('btn-update-location').addEventListener('click', updateMyLocation);
}

async function refreshMapLocations() {
  const statusEl  = document.getElementById('map-update-status');
  const countEl   = document.getElementById('map-count');
  const listEl    = document.getElementById('location-list');
  if (!statusEl) return;

  let locations = [], users = [];
  try {
    [locations, users] = await Promise.all([api.getUserLocations(), api.getUsers()]);
  } catch { return; }

  const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

  if (statusEl) statusEl.textContent = `Updated ${new Date().toLocaleTimeString('en-GB')}`;
  if (countEl)  countEl.textContent = `${locations.length} user${locations.length !== 1 ? 's' : ''} tracked`;

  /* Update markers */
  const seen = new Set();
  for (const loc of locations) {
    seen.add(loc.user_id);
    const u = userMap[loc.user_id];
    const label = u ? `${u.full_name} (${u.role})` : loc.user_id.slice(0, 8) + '…';
    const popup = `<strong>${label}</strong><br>Lat: ${loc.latitude.toFixed(5)}<br>Lng: ${loc.longitude.toFixed(5)}<br><small>${fmtDate(loc.updated_at || loc.created_at)}</small>`;

    if (_mapMarkers[loc.user_id]) {
      _mapMarkers[loc.user_id].setLatLng([loc.latitude, loc.longitude]).setPopupContent(popup);
    } else {
      const color = u?.role === 'coordinator' ? '#3498db' : u?.role === 'firefighter' ? '#f05a1a' : '#8a94a8';
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      _mapMarkers[loc.user_id] = L.marker([loc.latitude, loc.longitude], { icon })
        .addTo(_mapInstance)
        .bindPopup(popup);
    }
  }

  /* Remove stale markers */
  for (const uid of Object.keys(_mapMarkers)) {
    if (!seen.has(uid)) {
      _mapInstance.removeLayer(_mapMarkers[uid]);
      delete _mapMarkers[uid];
    }
  }

  /* Fit bounds if we have markers */
  if (locations.length && _mapInstance) {
    const coords = locations.map(l => [l.latitude, l.longitude]);
    try { _mapInstance.fitBounds(coords, { padding: [40, 40], maxZoom: 14 }); } catch {}
  }

  /* Location list chips */
  if (listEl) {
    listEl.innerHTML = locations.length
      ? locations.map(loc => {
          const u = userMap[loc.user_id];
          return `<span class="chip">${u ? u.full_name : loc.user_id.slice(0,8)+'…'} <span style="color:var(--text-muted)">(${u?.role || '?'})</span></span>`;
        }).join('')
      : '<span style="color:var(--text-muted);font-size:13px">No locations reported yet</span>';
  }
}

async function updateMyLocation() {
  const btn = document.getElementById('btn-update-location');
  const user = getCurrentUser();
  if (!user) { toast('Not logged in', 'error'); return; }

  if (!navigator.geolocation) {
    toast('Geolocation not supported by this browser', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Getting location…';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        await api.upsertLocation({
          user_id:   user.id,
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        toast('Location updated', 'success');
        await refreshMapLocations();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '📍 Update My Location';
      }
    },
    (err) => {
      toast(`Geolocation error: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = '📍 Update My Location';
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}
