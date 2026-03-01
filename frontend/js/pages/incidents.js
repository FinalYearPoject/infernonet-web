/* ===== Incidents List Page ===== */

async function renderIncidents() {
  mount(`<div class="page"><div class="loading-state"><span class="spinner"></span> Loading incidents…</div></div>`);

  let incidents = [];
  let orgs = [];
  try {
    [incidents, orgs] = await Promise.all([api.getIncidents(), api.getOrganizations()]);
  } catch (err) {
    mount(`<div class="page"><div class="empty-state"><span class="empty-icon">⚠️</span>${err.message}</div></div>`);
    return;
  }

  const orgMap = Object.fromEntries((orgs || []).map(o => [o.id, o.name]));

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
          <td>${orgMap[inc.organization_id] || '—'}</td>
          <td style="color:var(--text-secondary)">${inc.address || '—'}</td>
          <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(inc.created_at)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/incidents/${inc.id}'">View</button>
          </td>
        </tr>`)
      .join('')
    : `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">🔥</span>No incidents yet</div></td></tr>`;

  mount(`
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Incidents</div>
          <div class="page-subtitle">${incidents.length} incident${incidents.length !== 1 ? 's' : ''} total</div>
        </div>
        ${getCurrentUser()?.role === 'coordinator' ? `<button class="btn btn-primary" id="btn-new-incident">+ New Incident</button>` : ''}
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
              <th>Organization</th>
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
            <td>${orgMap[inc.organization_id] || '—'}</td>
            <td style="color:var(--text-secondary)">${inc.address || '—'}</td>
            <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(inc.created_at)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/incidents/${inc.id}'">View</button></td>
          </tr>`).join('')
      : `<tr><td colspan="7"><div class="empty-state"><span class="empty-icon">🔍</span>No matching incidents</div></td></tr>`;
  }
  document.getElementById('filter-severity').addEventListener('change', applyFilter);
  document.getElementById('filter-status').addEventListener('change', applyFilter);

  /* Create incident modal — coordinator only */
  document.getElementById('btn-new-incident')?.addEventListener('click', () => {
    const user = getCurrentUser();
    openModal('New Incident', `
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
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="inc-status">
              <option value="reported">Reported</option>
              <option value="active">Active</option>
              <option value="contained">Contained</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <input class="form-control" id="inc-address" placeholder="123 Main St, Los Angeles" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Latitude *</label>
            <input class="form-control" id="inc-lat" type="number" step="any" placeholder="34.0522" required />
          </div>
          <div class="form-group">
            <label class="form-label">Longitude *</label>
            <input class="form-control" id="inc-lng" type="number" step="any" placeholder="-118.2437" required />
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="inc-submit-btn">Create Incident</button>
        </div>
      </form>
    `);

    document.getElementById('incident-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('inc-submit-btn');
      btn.disabled = true; btn.textContent = 'Creating…';
      try {
        await api.createIncident({
          title:       document.getElementById('inc-title').value.trim(),
          description: document.getElementById('inc-desc').value.trim() || null,
          severity:    document.getElementById('inc-severity').value,
          address:     document.getElementById('inc-address').value.trim() || null,
          latitude:    parseFloat(document.getElementById('inc-lat').value),
          longitude:   parseFloat(document.getElementById('inc-lng').value),
          created_by:  user?.id || null,
        });
        closeModal();
        toast('Incident created', 'success');
        renderIncidents();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Create Incident';
      }
    });
  });
}
