/* ===== Organizations Page ===== */

async function renderOrganizations() {
  mount(`<div class="page"><div class="loading-state"><span class="spinner"></span> Loading organizations…</div></div>`);

  let orgs = [];
  try {
    orgs = await api.getOrganizations();
  } catch (err) {
    mount(`<div class="page"><div class="empty-state"><span class="empty-icon">⚠️</span>${err.message}</div></div>`);
    return;
  }

  const user = getCurrentUser();
  const canEdit = user?.role === 'coordinator';

  function formatOrgType(t) {
    if (!t) return '—';
    return String(t).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function buildRows(list) {
    if (!list.length) {
      return `<tr><td colspan="6"><div class="empty-state" style="padding:20px"><span class="empty-icon">🏢</span>No organizations yet</div></td></tr>`;
    }
    return list.map(o => `
      <tr>
        <td style="font-weight:500">${o.name}</td>
        <td><span class="badge badge-${o.type}">${formatOrgType(o.type)}</span></td>
        <td>${o.contact_phone || '—'}</td>
        <td style="color:var(--text-secondary)">${o.address || '—'}</td>
        <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(o.created_at)}</td>
        <td style="display:flex;gap:6px">
          ${canEdit ? `
            <button class="btn btn-ghost btn-sm" onclick="openEditOrgModal('${o.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteOrg('${o.id}','${o.name.replace(/'/g,"\\'")}')">Delete</button>
          ` : ''}
        </td>
      </tr>`).join('');
  }

  mount(`
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Organizations</div>
          <div class="page-subtitle">${orgs.length} organization${orgs.length !== 1 ? 's' : ''} total</div>
        </div>
        ${canEdit ? `<button class="btn btn-primary" id="btn-new-org">+ New Organization</button>` : ''}
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="orgs-tbody">${buildRows(orgs)}</tbody>
        </table>
      </div>
    </div>
  `);

  if (canEdit) {
    document.getElementById('btn-new-org').addEventListener('click', () => openCreateOrgModal(() => renderOrganizations()));
  }
}

/* ===== Create Organization Modal ===== */
function openCreateOrgModal(onSuccess) {
  openModal('New Organization', `
    <form id="create-org-form">
      <div class="form-group">
        <label class="form-label">Name *</label>
        <input class="form-control" id="org-name" placeholder="e.g. Central Fire Department" required />
      </div>
      <div class="form-group">
        <label class="form-label">Type *</label>
        <select class="form-control" id="org-type" required>
          <option value="">Select…</option>
          <option value="fire_department">Fire Department</option>
          <option value="emergency_services">Emergency Services</option>
          <option value="government">Government</option>
          <option value="ngo">NGO</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Contact Phone</label>
        <input class="form-control" id="org-phone" placeholder="+1 555 000 000" />
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <input class="form-control" id="org-address" placeholder="123 Main St, Los Angeles" />
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="org-submit-btn">Create</button>
      </div>
    </form>
  `);

  document.getElementById('create-org-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('org-submit-btn');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      await api.createOrganization({
        name:          document.getElementById('org-name').value.trim(),
        type:          document.getElementById('org-type').value,
        contact_phone: document.getElementById('org-phone').value.trim() || null,
        address:       document.getElementById('org-address').value.trim() || null,
      });
      closeModal();
      toast('Organization created', 'success');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Create';
    }
  });
}

/* ===== Edit Organization Modal ===== */
async function openEditOrgModal(orgId) {
  let org;
  try { org = await api.getOrganization(orgId); }
  catch (err) { toast(err.message, 'error'); return; }

  openModal('Edit Organization', `
    <form id="edit-org-form">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-control" id="eorg-name" value="${org.name}" />
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-control" id="eorg-type">
          <option value="fire_department"    ${org.type === 'fire_department'    ? 'selected' : ''}>Fire Department</option>
          <option value="emergency_services" ${org.type === 'emergency_services' ? 'selected' : ''}>Emergency Services</option>
          <option value="government"         ${org.type === 'government'         ? 'selected' : ''}>Government</option>
          <option value="ngo"                ${org.type === 'ngo'                ? 'selected' : ''}>NGO</option>
          <option value="other"              ${org.type === 'other'              ? 'selected' : ''}>Other</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Contact Phone</label>
        <input class="form-control" id="eorg-phone" value="${org.contact_phone || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <input class="form-control" id="eorg-address" value="${org.address || ''}" />
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="eorg-btn">Save</button>
      </div>
    </form>
  `);

  document.getElementById('edit-org-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('eorg-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api.updateOrganization(orgId, {
        name:          document.getElementById('eorg-name').value.trim(),
        type:          document.getElementById('eorg-type').value,
        contact_phone: document.getElementById('eorg-phone').value.trim() || null,
        address:       document.getElementById('eorg-address').value.trim() || null,
      });
      closeModal();
      toast('Organization updated', 'success');
      renderOrganizations();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Save';
    }
  });
}

/* ===== Delete Organization ===== */
async function deleteOrg(id, name) {
  if (!confirm(`Delete organization "${name}"? This cannot be undone.`)) return;
  try {
    await api.deleteOrganization(id);
    toast('Organization deleted', 'success');
    renderOrganizations();
  } catch (err) {
    toast(err.message, 'error');
  }
}
