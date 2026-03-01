/* ===== Incident Detail Page ===== */

async function renderIncidentDetail(id) {
  mount(`<div class="page"><div class="loading-state"><span class="spinner"></span> Loading incident…</div></div>`);

  let incident, teams, alerts, channels, users;
  try {
    [incident, teams, alerts, channels, users] = await Promise.all([
      api.getIncident(id),
      api.getTeams({ incident_id: id }),
      api.getAlerts({ incident_id: id }),
      api.getChannels({ incident_id: id }),
      api.getUsers(),
    ]);
  } catch (err) {
    mount(`<div class="page"><div class="empty-state"><span class="empty-icon">⚠️</span>${err.message}</div></div>`);
    return;
  }

  if (!incident) return;

  const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

  /* Teams section */
  const teamsHTML = (teams || []).length
    ? (teams).map(t => `
        <tr>
          <td>${t.name}</td>
          <td>${t.member_count ?? '—'}</td>
          <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(t.created_at)}</td>
        </tr>`).join('')
    : `<tr><td colspan="3"><div class="empty-state" style="padding:20px">No teams assigned</div></td></tr>`;

  /* Alerts section */
  const alertsHTML = (alerts || []).length
    ? (alerts).map(a => `
        <tr>
          <td>${a.message}</td>
          <td>${badge(a.severity)}</td>
          <td>${badge(a.type)}</td>
          <td style="color:var(--text-muted);font-size:13px">${fmtDate(a.created_at)}</td>
        </tr>`).join('')
    : `<tr><td colspan="4"><div class="empty-state" style="padding:20px">No alerts</div></td></tr>`;

  /* Channels section */
  const channelsHTML = (channels || []).length
    ? (channels).map(c => `
        <tr>
          <td>
            <span class="td-link" onclick="window.location.hash='#/channels/${c.id}'">${c.name}</span>
          </td>
          <td>${c.is_public ? '<span class="badge badge-active">Public</span>' : '<span class="badge badge-closed">Private</span>'}</td>
          <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(c.created_at)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/channels/${c.id}'">Open</button>
          </td>
        </tr>`).join('')
    : `<tr><td colspan="4"><div class="empty-state" style="padding:20px">No channels</div></td></tr>`;

  mount(`
    <div class="page">
      <div class="back-btn" onclick="window.location.hash='#/incidents'">← Back to Incidents</div>

      <div class="page-header">
        <div>
          <div class="page-title">${incident.title}</div>
          <div class="page-subtitle">Incident ID: ${incident.id}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          ${badge(incident.severity)}
          ${badge(incident.status)}
          <button class="btn btn-secondary btn-sm" id="btn-edit-incident">Edit Status</button>
        </div>
      </div>

      <!-- Info card -->
      <div class="card">
        <div class="detail-grid">
          <div class="detail-field">
            <div class="detail-label">Description</div>
            <div class="detail-value">${incident.description || '—'}</div>
          </div>
          <div class="detail-field">
            <div class="detail-label">Address</div>
            <div class="detail-value">${incident.address || '—'}</div>
          </div>
          <div class="detail-field">
            <div class="detail-label">Coordinates</div>
            <div class="detail-value">
              ${incident.latitude != null ? `${incident.latitude}, ${incident.longitude}` : '—'}
            </div>
          </div>
          <div class="detail-field">
            <div class="detail-label">Created by</div>
            <div class="detail-value">${userMap[incident.created_by]?.full_name || incident.created_by || '—'}</div>
          </div>
          <div class="detail-field">
            <div class="detail-label">Created at</div>
            <div class="detail-value">${fmtDate(incident.created_at)}</div>
          </div>
          <div class="detail-field">
            <div class="detail-label">Updated at</div>
            <div class="detail-value">${fmtDate(incident.updated_at)}</div>
          </div>
        </div>
      </div>

      <!-- Teams -->
      <div class="section-heading">
        <span>Teams (${(teams || []).length})</span>
        <button class="btn btn-secondary btn-sm" id="btn-add-team">+ Add Team</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Members</th><th>Created</th></tr></thead>
          <tbody>${teamsHTML}</tbody>
        </table>
      </div>

      <!-- Alerts -->
      <div class="section-heading">
        <span>Alerts (${(alerts || []).length})</span>
        <button class="btn btn-secondary btn-sm" id="btn-add-alert">+ Add Alert</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Message</th><th>Severity</th><th>Type</th><th>Sent</th></tr></thead>
          <tbody>${alertsHTML}</tbody>
        </table>
      </div>

      <!-- Channels -->
      <div class="section-heading">
        <span>Channels (${(channels || []).length})</span>
        <button class="btn btn-secondary btn-sm" id="btn-add-channel">+ Add Channel</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Visibility</th><th>Created</th><th></th></tr></thead>
          <tbody>${channelsHTML}</tbody>
        </table>
      </div>
    </div>
  `);

  /* Edit status */
  document.getElementById('btn-edit-incident').addEventListener('click', () => {
    openModal('Edit Incident Status', `
      <form id="edit-incident-form">
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="edit-inc-status">
            <option value="active"   ${incident.status === 'active'   ? 'selected' : ''}>Active</option>
            <option value="resolved" ${incident.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            <option value="closed"   ${incident.status === 'closed'   ? 'selected' : ''}>Closed</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Severity</label>
          <select class="form-control" id="edit-inc-severity">
            <option value="low"      ${incident.severity === 'low'      ? 'selected' : ''}>Low</option>
            <option value="medium"   ${incident.severity === 'medium'   ? 'selected' : ''}>Medium</option>
            <option value="high"     ${incident.severity === 'high'     ? 'selected' : ''}>High</option>
            <option value="critical" ${incident.severity === 'critical' ? 'selected' : ''}>Critical</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="edit-inc-btn">Save</button>
        </div>
      </form>
    `);
    document.getElementById('edit-incident-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('edit-inc-btn');
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await api.updateIncident(id, {
          status:   document.getElementById('edit-inc-status').value,
          severity: document.getElementById('edit-inc-severity').value,
        });
        closeModal();
        toast('Incident updated', 'success');
        renderIncidentDetail(id);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Save';
      }
    });
  });

  /* Add team */
  document.getElementById('btn-add-team').addEventListener('click', () => {
    const user = getCurrentUser();
    openModal('Add Team', `
      <form id="add-team-form">
        <div class="form-group">
          <label class="form-label">Team Name *</label>
          <input class="form-control" id="team-name" placeholder="e.g. Alpha Squad" required />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="add-team-btn">Create Team</button>
        </div>
      </form>
    `);
    document.getElementById('add-team-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('add-team-btn');
      btn.disabled = true; btn.textContent = 'Creating…';
      try {
        await api.createTeam({
          name:        document.getElementById('team-name').value.trim(),
          incident_id: id,
          organization_id: incident.organization_id || null,
        });
        closeModal();
        toast('Team created', 'success');
        renderIncidentDetail(id);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Create Team';
      }
    });
  });

  /* Add alert */
  document.getElementById('btn-add-alert').addEventListener('click', () => {
    const user = getCurrentUser();
    openModal('Send Alert', `
      <form id="add-alert-form">
        <div class="form-group">
          <label class="form-label">Message *</label>
          <textarea class="form-control" id="alert-msg" rows="3" placeholder="Alert message…" required></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Severity</label>
            <select class="form-control" id="alert-severity">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high" selected>High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-control" id="alert-type">
              <option value="evacuation">Evacuation</option>
              <option value="hazard">Hazard</option>
              <option value="resource_request">Resource request</option>
              <option value="status_update">Status update</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="add-alert-btn">Send Alert</button>
        </div>
      </form>
    `);
    document.getElementById('add-alert-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('add-alert-btn');
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        await api.createAlert({
          incident_id: id,
          message:     document.getElementById('alert-msg').value.trim(),
          severity:    document.getElementById('alert-severity').value,
          type:        document.getElementById('alert-type').value,
          sent_by:     user?.id || null,
        });
        closeModal();
        toast('Alert sent', 'success');
        renderIncidentDetail(id);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Send Alert';
      }
    });
  });

  /* Add channel */
  document.getElementById('btn-add-channel').addEventListener('click', () => {
    const user = getCurrentUser();
    openModal('Add Channel', `
      <form id="add-channel-form">
        <div class="form-group">
          <label class="form-label">Channel Name *</label>
          <input class="form-control" id="ch-name" placeholder="e.g. General comms" required />
        </div>
        <div class="form-group">
          <label class="form-label">Visibility</label>
          <select class="form-control" id="ch-public">
            <option value="false">Private</option>
            <option value="true">Public</option>
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="add-ch-btn">Create Channel</button>
        </div>
      </form>
    `);
    document.getElementById('add-channel-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('add-ch-btn');
      btn.disabled = true; btn.textContent = 'Creating…';
      try {
        await api.createChannel({
          name:        document.getElementById('ch-name').value.trim(),
          incident_id: id,
          is_public:   document.getElementById('ch-public').value === 'true',
          created_by:  user?.id || null,
        });
        closeModal();
        toast('Channel created', 'success');
        renderIncidentDetail(id);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Create Channel';
      }
    });
  });
}
