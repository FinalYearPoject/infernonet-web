/* ===== Live Map — Incidents ===== */

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
          <div class="page-subtitle">All incidents by location</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <label style="font-size:13px;color:var(--text-muted)">Status:</label>
          <select class="form-control" id="map-status-filter" style="width:auto;min-width:140px">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="reported">Reported</option>
            <option value="active">Active</option>
            <option value="contained">Contained</option>
            <option value="resolved">Resolved</option>
          </select>
          <span id="map-update-status" style="font-size:13px;color:var(--text-muted)"></span>
        </div>
      </div>

      <div id="map-container" style="height:520px;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border)"></div>

      <div class="section-heading" style="margin-top:24px">
        <span>Incidents on map</span>
        <span id="map-count" style="color:var(--text-muted);font-size:13px"></span>
      </div>
      <div id="incident-list" class="chip-list" style="margin-top:8px"></div>
    </div>
  `);

  if (_mapInstance) {
    _mapInstance.remove();
    _mapInstance = null;
  }
  Object.keys(_mapMarkers).forEach(k => delete _mapMarkers[k]);

  if (typeof L === 'undefined') {
    document.getElementById('map-container').innerHTML =
      '<div class="empty-state"><span class="empty-icon">🗺️</span>Map library not loaded. Check your internet connection.</div>';
    return;
  }

  _mapInstance = L.map('map-container').setView([39.0, 22.0], 6);  /* Greece */
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(_mapInstance);

  async function refresh() {
    await refreshMapIncidents();
  }

  await refresh();

  document.getElementById('map-status-filter').addEventListener('change', refresh);

  _mapPollTimer = setInterval(async () => {
    if (!document.getElementById('map-container')) {
      clearInterval(_mapPollTimer);
      return;
    }
    await refresh();
  }, 10000);
}

async function refreshMapIncidents() {
  const statusEl = document.getElementById('map-update-status');
  const countEl = document.getElementById('map-count');
  const listEl = document.getElementById('incident-list');
  const filterEl = document.getElementById('map-status-filter');
  if (!statusEl || !_mapInstance) return;

  const statusFilter = filterEl ? filterEl.value : '';
  let incidents = [];
  try {
    incidents = await api.getIncidents(statusFilter ? { status_filter: statusFilter } : {});
  } catch {
    return;
  }

  incidents = (incidents || []).filter(i => i.latitude != null && i.longitude != null);

  if (statusEl) statusEl.textContent = `Updated ${new Date().toLocaleTimeString('en-GB')}`;
  if (countEl) countEl.textContent = `${incidents.length} incident${incidents.length !== 1 ? 's' : ''}`;

  const seen = new Set();
  const severityColor = { critical: '#c0392b', high: '#e74c3c', medium: '#f39c12', low: '#27ae60', pending: '#95a5a6' };

  for (const inc of incidents) {
    const id = inc.id;
    seen.add(id);
    const lat = Number(inc.latitude);
    const lng = Number(inc.longitude);
    const color = severityColor[inc.severity] || severityColor[inc.status] || '#3498db';
    const popup = `<strong>${(inc.title || '').replace(/</g, '&lt;')}</strong><br>${badge(inc.status)} ${badge(inc.severity)}<br>${inc.address ? (inc.address + '<br>').replace(/</g, '&lt;') : ''}<a href="#/incidents/${id}">View incident</a>`;

    if (_mapMarkers[id]) {
      _mapMarkers[id].setLatLng([lat, lng]).setPopupContent(popup);
    } else {
      const icon = L.divIcon({
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      _mapMarkers[id] = L.marker([lat, lng], { icon })
        .addTo(_mapInstance)
        .bindPopup(popup);
    }
  }

  for (const id of Object.keys(_mapMarkers)) {
    if (!seen.has(id)) {
      _mapInstance.removeLayer(_mapMarkers[id]);
      delete _mapMarkers[id];
    }
  }

  if (incidents.length && _mapInstance) {
    const coords = incidents.map(i => [Number(i.latitude), Number(i.longitude)]);
    try { _mapInstance.fitBounds(coords, { padding: [40, 40], maxZoom: 14 }); } catch {}
  }

  if (listEl) {
    listEl.innerHTML = incidents.length
      ? incidents.map(inc => `<a href="#/incidents/${inc.id}" class="chip">${(inc.title || 'Incident').slice(0, 30)}${(inc.title || '').length > 30 ? '…' : ''} ${badge(inc.status)}</a>`).join('')
      : '<span style="color:var(--text-muted);font-size:13px">No incidents to show</span>';
  }
}
