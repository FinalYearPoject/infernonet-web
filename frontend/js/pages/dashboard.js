/* ===== Hot Dashboard (Firefighter) ===== */

function openGoogleMapsRoute(lat, lng) {
  if (lat == null || lng == null) return;
  const dest = `${Number(lat)},${Number(lng)}`;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function renderHotDashboard() {
  const user = getCurrentUser();
  if (user?.role !== 'firefighter') {
    window.location.hash = '#/incidents';
    return;
  }

  mount(`<div class="page"><div class="loading-state"><span class="spinner"></span> Loading your assignments…</div></div>`);

  let myTeams = [];
  try {
    myTeams = await api.getTeams({ member_id: user.id });
  } catch (err) {
    mount(`<div class="page"><div class="empty-state"><span class="empty-icon">⚠️</span>${err.message}</div></div>`);
    return;
  }

  const incidentIds = [...new Set((myTeams || []).map(t => t.incident_id).filter(Boolean))];
  if (!incidentIds.length) {
    mount(`
      <div class="page">
        <div class="page-header">
          <div>
            <div class="page-title">🔥 Hot Dashboard</div>
            <div class="page-subtitle">Your assigned incidents and resources</div>
          </div>
        </div>
        <div class="empty-state" style="margin-top:2rem">
          <span class="empty-icon">👷</span>
          <p>You are not assigned to any incident yet.</p>
          <p style="color:var(--text-muted);font-size:14px">When a coordinator adds you to a team on an incident, it will appear here.</p>
        </div>
      </div>
    `);
    return;
  }

  let incidents = [], alertsByIncident = {}, channelsByIncident = {}, equipmentByIncident = {}, organizations = [];
  try {
    const [allIncidents, allAlerts, allChannels, allEquipment, orgs] = await Promise.all([
      api.getIncidents(),
      Promise.all(incidentIds.map(id => api.getAlerts({ incident_id: id }))).then(arr =>
        Object.fromEntries(incidentIds.map((id, i) => [id, arr[i] || []])),
      ),
      Promise.all(incidentIds.map(id => api.getChannels({ incident_id: id }))).then(arr =>
        Object.fromEntries(incidentIds.map((id, i) => [id, arr[i] || []])),
      ),
      Promise.all(incidentIds.map(id => api.getEquipment({ incident_id: id }))).then(arr =>
        Object.fromEntries(incidentIds.map((id, i) => [id, arr[i] || []])),
      ),
      api.getOrganizations(),
    ]);
    incidents = (allIncidents || []).filter(inc => incidentIds.includes(inc.id));
    alertsByIncident = allAlerts;
    channelsByIncident = allChannels;
    equipmentByIncident = allEquipment;
    organizations = orgs || [];
  } catch (err) {
    mount(`<div class="page"><div class="empty-state"><span class="empty-icon">⚠️</span>${err.message}</div></div>`);
    return;
  }

  const orgMap = Object.fromEntries((organizations || []).map(o => [o.id, o.name]));
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  incidents.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  function buildIncidentCards(incidentList) {
    return (incidentList || []).map(inc => {
    const alerts = alertsByIncident[inc.id] || [];
    const channels = channelsByIncident[inc.id] || [];
    const equipment = equipmentByIncident[inc.id] || [];
    const hasCoords = inc.latitude != null && inc.longitude != null;
    return `
      <article class="card dashboard-incident-card">
        <div class="dashboard-card-header">
          <div class="dashboard-card-heading">
            <h3 class="dashboard-incident-title">
              <a href="#/incidents/${inc.id}" class="td-link">${(inc.title || 'Incident').replace(/</g, '&lt;')}</a>
            </h3>
            <div class="dashboard-card-meta">
              ${badge(inc.severity)} ${badge(inc.status)}
              ${inc.address ? `<span class="dashboard-address">📍 ${(inc.address || '').replace(/</g, '&lt;')}</span>` : ''}
            </div>
          </div>
          ${hasCoords ? `<button type="button" class="btn btn-secondary btn-sm dashboard-route-btn" onclick="openGoogleMapsRoute(${inc.latitude},${inc.longitude})">🗺️ Route (Maps)</button>` : ''}
        </div>
        <div class="card-body dashboard-card-body">
          <div class="dashboard-grid">
            <div class="dashboard-block">
              <div class="dashboard-block-title">Alerts (${alerts.length})</div>
              ${alerts.length ? `
                <ul class="dashboard-list">
                  ${alerts.slice(0, 5).map(a => `
                    <li>${badge(a.severity)} ${(a.title || a.message || '').slice(0, 60).replace(/</g, '&lt;')}${(a.title || a.message || '').length > 60 ? '…' : ''}
                      <span class="dashboard-meta">${fmtDateShort(a.created_at)}</span></li>
                  `).join('')}
                  ${alerts.length > 5 ? `<li class="dashboard-more">+${alerts.length - 5} more</li>` : ''}
                </ul>
              ` : '<p class="dashboard-empty">No alerts</p>'}
            </div>
            <div class="dashboard-block">
              <div class="dashboard-block-title">Channels (${channels.length})</div>
              ${channels.length ? `
                <ul class="dashboard-list">
                  ${channels.map(c => `
                    <li><a href="#/channels/${c.id}" class="td-link">${(c.name || 'Channel').replace(/</g, '&lt;')}</a>
                      ${c.is_public ? '<span class="badge badge-active badge-sm">Public</span>' : ''}</li>
                  `).join('')}
                </ul>
              ` : '<p class="dashboard-empty">No channels</p>'}
            </div>
            <div class="dashboard-block">
              <div class="dashboard-block-title">Equipment (${equipment.length})</div>
              ${equipment.length ? `
                <ul class="dashboard-list">
                  ${equipment.map(e => `
                    <li class="dashboard-equipment-item">
                      <span class="dashboard-equipment-name">${(e.name || e.type || '—').replace(/</g, '&lt;')}</span>
                      <span class="badge badge-${e.status} badge-sm">${(e.status || '').replace(/_/g, ' ').toUpperCase()}</span>
                      ${orgMap[e.organization_id] ? `<span class="dashboard-meta">${orgMap[e.organization_id]}</span>` : ''}
                    </li>
                  `).join('')}
                </ul>
              ` : '<p class="dashboard-empty">No equipment assigned</p>'}
            </div>
          </div>
        </div>
      </article>
    `;
    }).join('');
  }

  let hideInactive = true;
  const activeIncidents = () => incidents.filter(i => i.status !== 'resolved');
  const inactiveIncidents = () => incidents.filter(i => i.status === 'resolved');

  function renderCards() {
    const active = activeIncidents();
    const inactive = hideInactive ? [] : inactiveIncidents();
    const activeContainer = document.getElementById('dashboard-cards-active');
    const inactiveSection = document.getElementById('dashboard-inactive-section');
    const inactiveContainer = document.getElementById('dashboard-cards-inactive');
    const sub = document.getElementById('dashboard-subtitle');
    if (activeContainer) activeContainer.innerHTML = buildIncidentCards(active);
    if (inactiveSection) {
      if (inactive.length) {
        inactiveSection.style.display = '';
        if (inactiveContainer) inactiveContainer.innerHTML = buildIncidentCards(inactive);
      } else {
        inactiveSection.style.display = 'none';
      }
    }
    const total = active.length + inactive.length;
    if (sub) sub.textContent = `${total} incident${total !== 1 ? 's' : ''} you're assigned to · Alerts, channels & equipment`;
  }

  const active = activeIncidents();
  const inactive = inactiveIncidents();
  const initialInactiveHtml = inactive.length ? buildIncidentCards(inactive) : '';
  const initialInactiveDisplay = hideInactive ? 'none' : '';

  mount(`
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">🔥 Hot Dashboard</div>
          <div class="page-subtitle" id="dashboard-subtitle">${incidents.length} incident${incidents.length !== 1 ? 's' : ''} you're assigned to · Alerts, channels & equipment</div>
        </div>
      </div>
      <div class="filter-bar" style="align-items:center;margin-bottom:16px">
        <label class="checkbox-label" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none">
          <input type="checkbox" id="dashboard-hide-inactive" checked />
          <span>Hide inactive</span>
        </label>
        <span style="font-size:12px;color:var(--text-muted)">Inactive = Resolved</span>
      </div>
      <div id="dashboard-cards-active">${buildIncidentCards(active)}</div>
      <div id="dashboard-inactive-section" class="dashboard-inactive-section" style="display:${initialInactiveDisplay}">
        <div class="section-heading" style="margin-top:24px"><span>Inactive</span></div>
        <div id="dashboard-cards-inactive">${initialInactiveHtml}</div>
      </div>
    </div>
  `);

  document.getElementById('dashboard-hide-inactive').addEventListener('change', () => {
    hideInactive = document.getElementById('dashboard-hide-inactive').checked;
    renderCards();
  });
}
