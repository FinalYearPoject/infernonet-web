/* ===== Incidents List Page ===== */

async function renderIncidents() {
  mount(`<div class="page"><div class="loading-state"><span class="spinner"></span> Loading incidents…</div></div>`);

  let incidents = [];
  try {
    incidents = await api.getIncidents();
  } catch (err) {
    mount(`<div class="page"><div class="empty-state"><span class="empty-icon">⚠️</span>${err.message}</div></div>`);
    return;
  }

  const orgMap = {};

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  incidents.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  const rows = incidents.length
    ? incidents.map(inc => `
        <tr>
          <td>
            <span class="td-link" onclick="window.location.hash='#/incidents/${inc.id}'">${inc.title}</span>
          </td>
          <td>${badge(inc.severity)}</td>
          <td>${badge(inc.status)}</td>
          <td style="color:var(--text-secondary)">${inc.address || '—'}</td>
          <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(inc.created_at)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/incidents/${inc.id}'">View</button>
          </td>
        </tr>`)
      .join('')
    : `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">🔥</span>No incidents yet</div></td></tr>`;

  const user = getCurrentUser();
  const isCivilian = user?.role === 'civilian';
  const isCoordinator = user?.role === 'coordinator';
  const showNewButton = isCoordinator || isCivilian;

  mount(`
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Incidents</div>
          <div class="page-subtitle">${incidents.length} incident${incidents.length !== 1 ? 's' : ''} total</div>
        </div>
        ${showNewButton ? `<button class="btn btn-primary" id="btn-new-incident">${isCivilian ? '+ Report Incident' : '+ New Incident'}</button>` : ''}
      </div>

      <div class="filter-bar">
        <select class="form-control" id="filter-severity">
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select class="form-control" id="filter-status">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="reported">Reported</option>
          <option value="active">Active</option>
          <option value="contained">Contained</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div class="table-wrap">
        <table id="incidents-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Address</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="incidents-tbody">${rows}</tbody>
        </table>
      </div>
    </div>
  `);

  /* Client-side filter */
  function applyFilter() {
    const sev = document.getElementById('filter-severity').value;
    const sta = document.getElementById('filter-status').value;
    const filtered = incidents.filter(i =>
      (!sev || i.severity === sev) && (!sta || i.status === sta)
    );
    document.getElementById('incidents-tbody').innerHTML = filtered.length
      ? filtered.map(inc => `
          <tr>
            <td><span class="td-link" onclick="window.location.hash='#/incidents/${inc.id}'">${inc.title}</span></td>
            <td>${badge(inc.severity)}</td>
            <td>${badge(inc.status)}</td>
            <td style="color:var(--text-secondary)">${inc.address || '—'}</td>
            <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(inc.created_at)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/incidents/${inc.id}'">View</button></td>
          </tr>`).join('')
      : `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">🔍</span>No matching incidents</div></td></tr>`;
  }
  document.getElementById('filter-severity').addEventListener('change', applyFilter);
  document.getElementById('filter-status').addEventListener('change', applyFilter);

  /* Create incident modal — coordinator or civilian (report) */
  document.getElementById('btn-new-incident')?.addEventListener('click', () => {
    const curUser = getCurrentUser();
    const isCivilian = curUser?.role === 'civilian';
    openModal(isCivilian ? 'Report Incident' : 'New Incident', `
      <form id="incident-form">
        <div class="form-group">
          <label class="form-label">Title *</label>
          <input class="form-control" id="inc-title" placeholder="e.g. Warehouse fire on 5th Ave" required />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="inc-desc" rows="3" placeholder="Describe the situation…"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Severity *</label>
            <select class="form-control" id="inc-severity" required>
              <option value="">Select…</option>
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          ${!isCivilian ? `
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="inc-status">
              <option value="reported" selected>Reported</option>
              <option value="active">Active</option>
              <option value="contained">Contained</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          ` : '<p style="font-size:13px;color:var(--text-muted)">Your report will be pending until a coordinator approves it.</p>'}
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <input class="form-control" id="inc-address" placeholder="e.g. Athens, Greece" />
        </div>
        <div class="form-group">
          <label class="form-label">Location *</label>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px">Click on the map to set the incident location</p>
          <div id="incident-form-map" style="height:240px;border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);background:var(--surface-alt)"></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Latitude *</label>
            <input class="form-control" id="inc-lat" type="number" step="any" placeholder="e.g. 39.0" required />
          </div>
          <div class="form-group">
            <label class="form-label">Longitude *</label>
            <input class="form-control" id="inc-lng" type="number" step="any" placeholder="e.g. 22.0" required />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="inc-submit-btn">${isCivilian ? 'Submit Report' : 'Create Incident'}</button>
        </div>
      </form>
    `);

    /* Init map for location picker (Greece) */
    function initIncidentFormMap() {
      if (typeof L === 'undefined') return;
      const mapEl = document.getElementById('incident-form-map');
      if (!mapEl) return;
      if (window._incidentFormMap) {
        window._incidentFormMap.remove();
        window._incidentFormMap = null;
      }
      const center = [39.0, 22.0];
      const map = L.map('incident-form-map').setView(center, 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);
      let marker = null;
      map.on('click', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        if (marker) marker.setLatLng(e.latlng);
        else {
          marker = L.marker(e.latlng).addTo(map);
          marker.bindPopup(`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
        }
        document.getElementById('inc-lat').value = lat.toFixed(6);
        document.getElementById('inc-lng').value = lng.toFixed(6);
      });
      window._incidentFormMap = map;
      setTimeout(() => map.invalidateSize(), 100);
    }
    setTimeout(initIncidentFormMap, 80);

    document.getElementById('incident-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('inc-submit-btn');
      const isCivilian = curUser?.role === 'civilian';
      btn.disabled = true; btn.textContent = isCivilian ? 'Submitting…' : 'Creating…';
      const payload = {
        title:       document.getElementById('inc-title').value.trim(),
        description: document.getElementById('inc-desc').value.trim() || null,
        severity:    document.getElementById('inc-severity').value,
        address:     document.getElementById('inc-address').value.trim() || null,
        latitude:    parseFloat(document.getElementById('inc-lat').value),
        longitude:   parseFloat(document.getElementById('inc-lng').value),
      };
      try {
        await api.createIncident(payload);
        closeModal();
        toast(isCivilian ? 'Report submitted. It will appear after coordinator approval.' : 'Incident created', 'success');
        renderIncidents();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = isCivilian ? 'Submit Report' : 'Create Incident';
      }
    });
  });
}
