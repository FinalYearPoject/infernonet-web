/* ===== Incident Detail Page ===== */

async function renderIncidentDetail(id) {
  mount(`<div class="page"><div class="loading-state"><span class="spinner"></span> Loading incident…</div></div>`);

  let incident, teams, alerts, channels, users, updates;
  try {
    [incident, teams, alerts, channels, users, updates] = await Promise.all([
      api.getIncident(id),
      api.getTeams({ incident_id: id }),
      api.getAlerts({ incident_id: id }),
      api.getChannels({ incident_id: id }),
      api.getUsers(),
      api.getIncidentUpdates(id),
    ]);
  } catch (err) {
    mount(`<div class="page"><div class="empty-state"><span class="empty-icon">⚠️</span>${err.message}</div></div>`);
    return;
  }

  if (!incident) return;

  const user = getCurrentUser();
  const isCoordinator = user?.role === 'coordinator';
  const isStaff = user?.role === 'coordinator' || user?.role === 'firefighter';
  const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

  /* Teams section — expandable rows with member loading */
  function buildTeamRows(teamList) {
    if (!(teamList || []).length) {
      return `<tr><td colspan="4"><div class="empty-state" style="padding:20px">No teams assigned</div></td></tr>`;
    }
    return teamList.map(t => `
      <tr>
        <td>
          <div style="font-weight:500">${t.name}</div>
        </td>
        <td><span id="member-count-${t.id}">${t.member_count ?? '—'}</span></td>
        <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(t.created_at)}</td>
        <td style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="toggleTeamMembers('${t.id}')">Members</button>
          ${isCoordinator ? `<button class="btn btn-ghost btn-sm" onclick="openAddTeamMemberModal('${t.id}')">+ Member</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTeamFromIncident('${t.id}','${t.name.replace(/'/g,"\\'")}','${id}')">Remove</button>` : ''}
        </td>
      </tr>
      <tr id="team-members-row-${t.id}" style="display:none">
        <td colspan="4" style="padding:0">
          <div id="team-members-${t.id}" style="padding:12px 16px;background:var(--surface-alt)">
            <span style="color:var(--text-muted)">Loading members…</span>
          </div>
        </td>
      </tr>`).join('');
  }

  /* Alerts section */
  function buildAlertRows(alertList) {
    if (!(alertList || []).length) {
      return `<tr><td colspan="4"><div class="empty-state" style="padding:20px">No alerts</div></td></tr>`;
    }
    return alertList.map(a => `
      <tr>
        <td><div style="font-weight:500">${a.title}</div><div style="font-size:12px;color:var(--text-muted)">${a.message}</div></td>
        <td>${badge(a.severity)}</td>
        <td style="color:var(--text-muted);font-size:13px">${fmtDate(a.created_at)}</td>
        <td>
          ${isCoordinator ? `<button class="btn btn-danger btn-sm" onclick="deleteAlertItem('${a.id}','${id}')">Delete</button>` : ''}
        </td>
      </tr>`).join('');
  }

  /* Channels section */
  const channelsHTML = (channels || []).length
    ? channels.map(c => `
        <tr>
          <td><span class="td-link" onclick="window.location.hash='#/channels/${c.id}'">${c.name}</span></td>
          <td>${c.is_public ? '<span class="badge badge-active">Public</span>' : '<span class="badge badge-closed">Private</span>'}</td>
          <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(c.created_at)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/channels/${c.id}'">Open</button></td>
        </tr>`).join('')
    : `<tr><td colspan="4"><div class="empty-state" style="padding:20px">No channels</div></td></tr>`;

  /* Timeline section */
  function buildTimeline(updateList) {
    if (!(updateList || []).length) {
      return '<div style="color:var(--text-muted);font-size:13px;padding:12px 0">No updates yet</div>';
    }
    return [...updateList].reverse().map(u => `
      <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:14px">📋</div>
        <div style="flex:1">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">
            ${userMap[u.user_id]?.full_name || 'System'} · ${fmtDate(u.created_at)}
            ${u.status_before && u.status_after ? `· <span style="font-size:12px">${badge(u.status_before)} → ${badge(u.status_after)}</span>` : ''}
          </div>
          <div>${u.content}</div>
        </div>
      </div>`).join('');
  }

  mount(`
    <div class="page">
      <div class="back-btn" onclick="window.location.hash='#/incidents'">← Back to Incidents</div>

      <div class="page-header">
        <div>
          <div class="page-title">${incident.title}</div>
          <div class="page-subtitle">Incident ID: ${incident.id}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          ${badge(incident.severity)}
          ${badge(incident.status)}
          ${incident.status === 'pending' ? '<span class="badge badge-pending" style="opacity:0.9">Awaiting coordinator approval</span>' : ''}
          ${isStaff ? `
            <button class="btn btn-secondary btn-sm" id="btn-edit-incident">Edit Status</button>
          ` : ''}
          ${isCoordinator ? `
            <button class="btn btn-danger btn-sm" id="btn-delete-incident">Delete</button>
          ` : ''}
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

      ${incident.latitude != null && incident.longitude != null ? `
      <!-- Location map -->
      <div class="section-heading"><span>Location</span></div>
      <div class="card" style="padding:0;overflow:hidden">
        <div id="incident-map-container" style="height:320px;width:100%"></div>
      </div>
      ` : ''}

      <!-- Teams -->
      <div class="section-heading">
        <span>Teams (${(teams || []).length})</span>
        ${isCoordinator ? `<button class="btn btn-secondary btn-sm" id="btn-add-team">+ Add Team</button>` : ''}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Members</th><th>Created</th><th></th></tr></thead>
          <tbody id="teams-tbody">${buildTeamRows(teams)}</tbody>
        </table>
      </div>

      <!-- Alerts -->
      <div class="section-heading">
        <span>Alerts (${(alerts || []).length})</span>
        ${isCoordinator ? `<button class="btn btn-secondary btn-sm" id="btn-add-alert">+ Send Alert</button>` : ''}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Title / Message</th><th>Severity</th><th>Sent</th><th></th></tr></thead>
          <tbody id="alerts-tbody">${buildAlertRows(alerts)}</tbody>
        </table>
      </div>

      <!-- Channels -->
      <div class="section-heading">
        <span>Channels (${(channels || []).length})</span>
        ${isStaff ? `<button class="btn btn-secondary btn-sm" id="btn-add-channel">+ Add Channel</button>` : ''}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Visibility</th><th>Created</th><th></th></tr></thead>
          <tbody>${channelsHTML}</tbody>
        </table>
      </div>

      <!-- Timeline -->
      <div class="section-heading">
        <span>Timeline (${(updates || []).length})</span>
        ${isStaff ? `<button class="btn btn-secondary btn-sm" id="btn-add-update">+ Add Update</button>` : ''}
      </div>
      <div id="timeline-container" style="padding:4px 0">
        ${buildTimeline(updates)}
      </div>
    </div>
  `);

  /* Init incident location map */
  if (incident.latitude != null && incident.longitude != null && typeof L !== 'undefined') {
    if (window._incidentDetailMap) {
      window._incidentDetailMap.remove();
      window._incidentDetailMap = null;
    }
    const mapEl = document.getElementById('incident-map-container');
    if (mapEl) {
      const lat = Number(incident.latitude);
      const lng = Number(incident.longitude);
      const map = L.map('incident-map-container').setView([lat, lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);
      L.marker([lat, lng])
        .addTo(map)
        .bindPopup(`<strong>${(incident.title || '').replace(/</g, '&lt;')}</strong>${incident.address ? '<br>' + (incident.address || '').replace(/</g, '&lt;') : ''}`);
      window._incidentDetailMap = map;
    }
  }

  /* Edit status — coordinator or firefighter */
  if (isStaff) {
    document.getElementById('btn-edit-incident').addEventListener('click', () => {
      openModal('Edit Incident Status', `
        <form id="edit-incident-form">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="edit-inc-status">
              <option value="pending"    ${incident.status === 'pending'    ? 'selected' : ''}>Pending</option>
              <option value="reported"  ${incident.status === 'reported'  ? 'selected' : ''}>Reported</option>
              <option value="active"    ${incident.status === 'active'    ? 'selected' : ''}>Active</option>
              <option value="contained" ${incident.status === 'contained' ? 'selected' : ''}>Contained</option>
              <option value="resolved"  ${incident.status === 'resolved'  ? 'selected' : ''}>Resolved</option>
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
  }

  /* Delete incident — coordinator only */
  if (isCoordinator) {
    document.getElementById('btn-delete-incident').addEventListener('click', async () => {
      if (!confirm(`Delete incident "${incident.title}"? This action cannot be undone.`)) return;
      try {
        await api.deleteIncident(id);
        toast('Incident deleted', 'success');
        window.location.hash = '#/incidents';
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  /* Add team */
  if (isCoordinator) {
    document.getElementById('btn-add-team').addEventListener('click', async () => {
      let orgOptions = '';
      try {
        const orgs = await api.getOrganizations();
        orgOptions = (orgs || []).map(o =>
          `<option value="${o.id}" ${o.id === incident.organization_id ? 'selected' : ''}>${o.name}</option>`
        ).join('');
      } catch {}
      openModal('Add Team', `
        <form id="add-team-form">
          <div class="form-group">
            <label class="form-label">Team Name *</label>
            <input class="form-control" id="team-name" placeholder="e.g. Alpha Squad" required />
          </div>
          <div class="form-group">
            <label class="form-label">Organization *</label>
            <select class="form-control" id="team-org" required>
              <option value="">Select…</option>
              ${orgOptions}
            </select>
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
            name:            document.getElementById('team-name').value.trim(),
            incident_id:     id,
            organization_id: document.getElementById('team-org').value,
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
  }

  /* Add alert */
  if (isCoordinator) {
    document.getElementById('btn-add-alert').addEventListener('click', () => {
      openModal('Send Alert', `
        <form id="add-alert-form">
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input class="form-control" id="alert-title" placeholder="e.g. Evacuation order" required />
          </div>
          <div class="form-group">
            <label class="form-label">Message *</label>
            <textarea class="form-control" id="alert-msg" rows="3" placeholder="Detailed alert message…" required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Severity</label>
            <select class="form-control" id="alert-severity">
              <option value="info">Info</option>
              <option value="warning" selected>Warning</option>
              <option value="critical">Critical</option>
            </select>
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
            title:       document.getElementById('alert-title').value.trim(),
            message:     document.getElementById('alert-msg').value.trim(),
            severity:    document.getElementById('alert-severity').value,
            created_by:  user?.id || null,
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
  }

  /* Add channel — coordinator or firefighter only */
  if (isStaff) {
    document.getElementById('btn-add-channel').addEventListener('click', () => {
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

  /* Add timeline update — coordinator or firefighter only */
  if (isStaff) {
    document.getElementById('btn-add-update').addEventListener('click', () => {
    openModal('Add Timeline Update', `
      <form id="add-update-form">
        <div class="form-group">
          <label class="form-label">Content *</label>
          <textarea class="form-control" id="upd-content" rows="4" placeholder="Describe what happened…" required></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Status Before</label>
            <select class="form-control" id="upd-status-before">
              <option value="">— None —</option>
              <option value="reported">Reported</option>
              <option value="active">Active</option>
              <option value="contained">Contained</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status After</label>
            <select class="form-control" id="upd-status-after">
              <option value="">— None —</option>
              <option value="reported">Reported</option>
              <option value="active">Active</option>
              <option value="contained">Contained</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="add-upd-btn">Add Update</button>
        </div>
      </form>
    `);
    document.getElementById('add-update-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('add-upd-btn');
      btn.disabled = true; btn.textContent = 'Adding…';
      try {
        await api.createIncidentUpdate(id, {
          content:       document.getElementById('upd-content').value.trim(),
          user_id:       user?.id || null,
          status_before: document.getElementById('upd-status-before').value || null,
          status_after:  document.getElementById('upd-status-after').value || null,
        });
        closeModal();
        toast('Update added', 'success');
        renderIncidentDetail(id);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Add Update';
      }
    });
  });
  }
}

/* ===== Toggle Team Members ===== */
async function toggleTeamMembers(teamId) {
  const row = document.getElementById(`team-members-row-${teamId}`);
  const container = document.getElementById(`team-members-${teamId}`);
  if (!row) return;

  if (row.style.display !== 'none') {
    row.style.display = 'none';
    return;
  }

  row.style.display = '';
  container.innerHTML = '<span style="color:var(--text-muted)">Loading…</span>';

  try {
    const members = await api.getTeamMembers(teamId);
    const user = getCurrentUser();
    const isCoordinator = user?.role === 'coordinator';
    if (!(members || []).length) {
      container.innerHTML = '<span style="color:var(--text-muted);font-size:13px">No members yet</span>';
      return;
    }
    container.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${members.map(m => `
          <span class="chip">
            ${m.full_name || m.user_id?.slice(0,8) || '?'}
            <span style="color:var(--text-muted);margin-left:4px;font-size:11px">(${m.role || ''})</span>
            ${isCoordinator ? `<button class="chip-remove" onclick="removeFromTeam('${teamId}','${m.user_id || m.id}')">×</button>` : ''}
          </span>`).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = `<span style="color:var(--text-danger)">${err.message}</span>`;
  }
}

/* ===== Add Team Member Modal ===== */
async function openAddTeamMemberModal(teamId) {
  let users;
  try { users = await api.getUsers(); }
  catch (err) { toast(err.message, 'error'); return; }

  const options = (users || []).map(u => `<option value="${u.id}">${u.full_name} (${u.role})</option>`).join('');

  openModal('Add Team Member', `
    <form id="add-member-form">
      <div class="form-group">
        <label class="form-label">Select User *</label>
        <select class="form-control" id="member-user" required>
          <option value="">Select…</option>
          ${options}
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="add-mem-btn">Add Member</button>
      </div>
    </form>
  `);

  document.getElementById('add-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('add-mem-btn');
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      await api.addTeamMember(teamId, document.getElementById('member-user').value);
      closeModal();
      toast('Member added', 'success');
      /* Refresh the member row if visible */
      const row = document.getElementById(`team-members-row-${teamId}`);
      if (row && row.style.display !== 'none') {
        await toggleTeamMembers(teamId);
        await toggleTeamMembers(teamId);
      }
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Add Member';
    }
  });
}

/* ===== Remove Team Member ===== */
async function removeFromTeam(teamId, userId) {
  if (!confirm('Remove this member from the team?')) return;
  try {
    await api.removeTeamMember(teamId, userId);
    toast('Member removed', 'success');
    /* Refresh the member row */
    const row = document.getElementById(`team-members-row-${teamId}`);
    if (row) {
      await toggleTeamMembers(teamId);
      await toggleTeamMembers(teamId);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ===== Delete Team from Incident ===== */
async function deleteTeamFromIncident(teamId, teamName, incidentId) {
  if (!confirm(`Remove team "${teamName}"? This cannot be undone.`)) return;
  try {
    await api.deleteTeam(teamId);
    toast('Team removed', 'success');
    renderIncidentDetail(incidentId);
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ===== Delete Alert ===== */
async function deleteAlertItem(alertId, incidentId) {
  if (!confirm('Delete this alert? This cannot be undone.')) return;
  try {
    await api.deleteAlert(alertId);
    toast('Alert deleted', 'success');
    renderIncidentDetail(incidentId);
  } catch (err) {
    toast(err.message, 'error');
  }
}
