/* ===== Equipment Page ===== */

async function renderEquipment() {
  mount(`<div class="page"><div class="loading-state"><span class="spinner"></span> Loading equipment…</div></div>`);

  let equipment = [], orgs = [], incidents = [];
  try {
    [equipment, orgs, incidents] = await Promise.all([
      api.getEquipment(),
      api.getOrganizations(),
      api.getIncidents(),
    ]);
  } catch (err) {
    mount(`<div class="page"><div class="empty-state"><span class="empty-icon">⚠️</span>${err.message}</div></div>`);
    return;
  }

  const orgMap = Object.fromEntries((orgs || []).map(o => [o.id, o.name]));
  const incMap = Object.fromEntries((incidents || []).map(i => [i.id, i.title]));
  const user = getCurrentUser();
  const canEdit = user?.role === 'coordinator';

  function buildRows(list) {
    if (!list.length) {
      return `<tr><td colspan="7"><div class="empty-state" style="padding:20px"><span class="empty-icon">🚒</span>No equipment found</div></td></tr>`;
    }
    return list.map(e => `
      <tr>
        <td>
          <div style="font-weight:500">${e.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${e.type}</div>
        </td>
        <td><span class="badge badge-${e.status}">${(e.status || '').replace(/_/g, ' ').toUpperCase()}</span></td>
        <td>${orgMap[e.organization_id] || '—'}</td>
        <td style="color:var(--text-secondary);font-size:13px">${incMap[e.incident_id] || '—'}</td>
        <td>${e.latitude != null ? `${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}` : '—'}</td>
        <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(e.created_at)}</td>
        <td style="display:flex;gap:6px">
          ${canEdit ? `
            <button class="btn btn-ghost btn-sm" onclick="openEditEquipmentModal('${e.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteEquipmentItem('${e.id}','${e.name.replace(/'/g,"\\'")}')">Delete</button>
          ` : ''}
        </td>
      </tr>`).join('');
  }

  mount(`
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Equipment</div>
          <div class="page-subtitle">${equipment.length} item${equipment.length !== 1 ? 's' : ''} total</div>
        </div>
        ${canEdit ? `<button class="btn btn-primary" id="btn-new-equipment">+ Add Equipment</button>` : ''}
      </div>

      <div class="filter-bar">
        <select class="form-control" id="filter-eq-status">
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="in_use">In use</option>
          <option value="maintenance">Maintenance</option>
          <option value="unavailable">Unavailable</option>
        </select>
        <select class="form-control" id="filter-eq-org">
          <option value="">All organizations</option>
          ${(orgs || []).map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name / Type</th>
              <th>Status</th>
              <th>Organization</th>
              <th>Incident</th>
              <th>Location</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="equipment-tbody">${buildRows(equipment)}</tbody>
        </table>
      </div>
    </div>
  `);

  function applyFilter() {
    const sta = document.getElementById('filter-eq-status').value;
    const org = document.getElementById('filter-eq-org').value;
    const filtered = equipment.filter(e =>
      (!sta || e.status === sta) && (!org || e.organization_id === org)
    );
    document.getElementById('equipment-tbody').innerHTML = buildRows(filtered);
  }
  document.getElementById('filter-eq-status').addEventListener('change', applyFilter);
  document.getElementById('filter-eq-org').addEventListener('change', applyFilter);

  if (canEdit) {
    document.getElementById('btn-new-equipment').addEventListener('click', () => {
      openCreateEquipmentModal(orgs, incidents, () => renderEquipment());
    });
  }
}

/* ===== Create Equipment Modal ===== */
function openCreateEquipmentModal(orgs, incidents, onSuccess) {
  const orgOptions = (orgs || []).map(o => `<option value="${o.id}">${o.name}</option>`).join('');
  const incOptions = (incidents || []).map(i => `<option value="${i.id}">${i.title}</option>`).join('');

  openModal('Add Equipment', `
    <form id="create-equipment-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input class="form-control" id="eq-name" placeholder="e.g. Fire Truck #7" required />
        </div>
        <div class="form-group">
          <label class="form-label">Type *</label>
          <input class="form-control" id="eq-type" placeholder="e.g. vehicle, hose, drone" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Organization *</label>
          <select class="form-control" id="eq-org" required>
            <option value="">Select…</option>
            ${orgOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="eq-status">
            <option value="available">Available</option>
            <option value="in_use">In use</option>
            <option value="maintenance">Maintenance</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Assign to Incident</label>
        <select class="form-control" id="eq-incident">
          <option value="">— Not assigned —</option>
          ${incOptions}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Latitude</label>
          <input class="form-control" id="eq-lat" type="number" step="any" placeholder="34.0522" />
        </div>
        <div class="form-group">
          <label class="form-label">Longitude</label>
          <input class="form-control" id="eq-lng" type="number" step="any" placeholder="-118.2437" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="eq-submit-btn">Add Equipment</button>
      </div>
    </form>
  `);

  document.getElementById('create-equipment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('eq-submit-btn');
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      const lat = document.getElementById('eq-lat').value;
      const lng = document.getElementById('eq-lng').value;
      await api.createEquipment({
        name:            document.getElementById('eq-name').value.trim(),
        type:            document.getElementById('eq-type').value.trim(),
        organization_id: document.getElementById('eq-org').value,
        status:          document.getElementById('eq-status').value,
        incident_id:     document.getElementById('eq-incident').value || null,
        latitude:        lat ? parseFloat(lat) : null,
        longitude:       lng ? parseFloat(lng) : null,
      });
      closeModal();
      toast('Equipment added', 'success');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Add Equipment';
    }
  });
}

/* ===== Edit Equipment Modal ===== */
async function openEditEquipmentModal(equipmentId) {
  let item, orgs, incidents;
  try {
    [item, orgs, incidents] = await Promise.all([
      api.getEquipmentItem(equipmentId),
      api.getOrganizations(),
      api.getIncidents(),
    ]);
  } catch (err) { toast(err.message, 'error'); return; }

  const orgOptions = (orgs || []).map(o =>
    `<option value="${o.id}" ${o.id === item.organization_id ? 'selected' : ''}>${o.name}</option>`
  ).join('');
  const incOptions = (incidents || []).map(i =>
    `<option value="${i.id}" ${i.id === item.incident_id ? 'selected' : ''}>${i.title}</option>`
  ).join('');

  openModal('Edit Equipment', `
    <form id="edit-equipment-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input class="form-control" id="eeq-name" value="${item.name}" />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <input class="form-control" id="eeq-type" value="${item.type}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Organization</label>
          <select class="form-control" id="eeq-org">
            <option value="">— None —</option>
            ${orgOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="eeq-status">
            <option value="available"   ${item.status === 'available'   ? 'selected' : ''}>Available</option>
            <option value="in_use"      ${item.status === 'in_use'      ? 'selected' : ''}>In use</option>
            <option value="maintenance" ${item.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
            <option value="unavailable" ${item.status === 'unavailable' ? 'selected' : ''}>Unavailable</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Incident</label>
        <select class="form-control" id="eeq-incident">
          <option value="">— Not assigned —</option>
          ${incOptions}
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="eeq-btn">Save Changes</button>
      </div>
    </form>
  `);

  document.getElementById('edit-equipment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('eeq-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api.updateEquipment(equipmentId, {
        name:            document.getElementById('eeq-name').value.trim(),
        type:            document.getElementById('eeq-type').value.trim(),
        organization_id: document.getElementById('eeq-org').value || null,
        status:          document.getElementById('eeq-status').value,
        incident_id:     document.getElementById('eeq-incident').value || null,
      });
      closeModal();
      toast('Equipment updated', 'success');
      renderEquipment();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Save Changes';
    }
  });
}

/* ===== Delete Equipment ===== */
async function deleteEquipmentItem(id, name) {
  if (!confirm(`Delete equipment "${name}"? This cannot be undone.`)) return;
  try {
    await api.deleteEquipment(id);
    toast('Equipment deleted', 'success');
    renderEquipment();
  } catch (err) {
    toast(err.message, 'error');
  }
}
