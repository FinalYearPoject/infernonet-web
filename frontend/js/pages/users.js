/* ===== Users Page ===== */

async function renderUsers() {
  mount(`<div class="page"><div class="loading-state"><span class="spinner"></span> Loading users…</div></div>`);

  let users = [], orgs = [];
  try {
    [users, orgs] = await Promise.all([api.getUsers(), api.getOrganizations()]);
  } catch (err) {
    mount(`<div class="page"><div class="empty-state"><span class="empty-icon">⚠️</span>${err.message}</div></div>`);
    return;
  }

  const orgMap = Object.fromEntries((orgs || []).map(o => [o.id, o.name]));

  const currentUser = getCurrentUser();
  const canManage = currentUser?.role === 'coordinator';

  function buildRows(list) {
    if (!list.length) return `<tr><td colspan="7"><div class="empty-state" style="padding:20px"><span class="empty-icon">👤</span>No users found</div></td></tr>`;
    return list.map(u => `
      <tr>
        <td>
          <div style="font-weight:500">${u.full_name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${u.email}</div>
        </td>
        <td>${badge(u.role)}</td>
        <td>${orgMap[u.organization_id] || '—'}</td>
        <td>${u.phone || '—'}</td>
        <td>
          ${u.is_active
            ? '<span class="badge badge-active">Active</span>'
            : '<span class="badge badge-closed">Inactive</span>'}
        </td>
        <td style="color:var(--text-muted);font-size:13px">${fmtDateShort(u.created_at)}</td>
        <td style="display:flex;gap:6px">
          ${canManage ? `
            <button class="btn btn-ghost btn-sm" onclick="openEditUserModal('${u.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUserById('${u.id}','${u.full_name.replace(/'/g,"\\'")}')">Delete</button>
          ` : ''}
        </td>
      </tr>`).join('');
  }

  mount(`
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Users</div>
          <div class="page-subtitle">${users.length} user${users.length !== 1 ? 's' : ''} total</div>
        </div>
        ${canManage ? `<button class="btn btn-primary" id="btn-new-user">+ New User</button>` : ''}
      </div>

      <div class="filter-bar">
        <input class="form-control" id="user-search" placeholder="Search by name or email…" />
        <select class="form-control" id="filter-role">
          <option value="">All roles</option>
          <option value="firefighter">Firefighter</option>
          <option value="coordinator">Coordinator</option>
          <option value="civilian">Civilian</option>
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name / Email</th>
              <th>Role</th>
              <th>Organization</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="users-tbody">${buildRows(users)}</tbody>
        </table>
      </div>
    </div>
  `);

  /* Client-side filter */
  function applyFilter() {
    const q    = document.getElementById('user-search').value.toLowerCase();
    const role = document.getElementById('filter-role').value;
    const filtered = users.filter(u =>
      (!role || u.role === role) &&
      (!q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
    document.getElementById('users-tbody').innerHTML = buildRows(filtered);
  }
  document.getElementById('user-search').addEventListener('input', applyFilter);
  document.getElementById('filter-role').addEventListener('change', applyFilter);

  /* Create user modal — coordinator only */
  document.getElementById('btn-new-user')?.addEventListener('click', () => openCreateUserModal(orgs, () => renderUsers()));
}

/* ===== Create User Modal ===== */
function openCreateUserModal(orgs, onSuccess) {
  const orgOptions = (orgs || []).map(o => `<option value="${o.id}">${o.name}</option>`).join('');

  openModal('New User', `
    <form id="create-user-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input class="form-control" id="cu-name" placeholder="Jane Smith" required />
        </div>
        <div class="form-group">
          <label class="form-label">Email *</label>
          <input class="form-control" id="cu-email" type="email" placeholder="jane@org.com" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Password *</label>
          <input class="form-control" id="cu-password" type="password" placeholder="••••••••" required />
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-control" id="cu-phone" placeholder="+1 555 000 000" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Role *</label>
          <select class="form-control" id="cu-role" required>
            <option value="">Select…</option>
            <option value="firefighter">Firefighter</option>
            <option value="coordinator">Coordinator</option>
            <option value="civilian">Civilian</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Organization</label>
          <select class="form-control" id="cu-org">
            <option value="">— None —</option>
            ${orgOptions}
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="cu-btn">Create User</button>
      </div>
    </form>
  `);

  document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('cu-btn');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      await api.createUser({
        full_name:       document.getElementById('cu-name').value.trim(),
        email:           document.getElementById('cu-email').value.trim(),
        password:        document.getElementById('cu-password').value,
        phone:           document.getElementById('cu-phone').value.trim() || null,
        role:            document.getElementById('cu-role').value,
        organization_id: document.getElementById('cu-org').value || null,
      });
      closeModal();
      toast('User created', 'success');
      if (onSuccess) onSuccess();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Create User';
    }
  });
}

/* ===== Edit User Modal ===== */
async function openEditUserModal(userId) {
  let user, orgs;
  try {
    [user, orgs] = await Promise.all([api.getUser(userId), api.getOrganizations()]);
  } catch (err) { toast(err.message, 'error'); return; }

  const orgOptions = (orgs || []).map(o =>
    `<option value="${o.id}" ${o.id === user.organization_id ? 'selected' : ''}>${o.name}</option>`
  ).join('');

  openModal('Edit User', `
    <form id="edit-user-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input class="form-control" id="eu-name" value="${user.full_name}" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-control" id="eu-phone" value="${user.phone || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Role</label>
          <select class="form-control" id="eu-role">
            <option value="firefighter" ${user.role === 'firefighter' ? 'selected' : ''}>Firefighter</option>
            <option value="coordinator" ${user.role === 'coordinator' ? 'selected' : ''}>Coordinator</option>
            <option value="civilian"    ${user.role === 'civilian'    ? 'selected' : ''}>Civilian</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Organization</label>
          <select class="form-control" id="eu-org">
            <option value="">— None —</option>
            ${orgOptions}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Active</label>
        <select class="form-control" id="eu-active">
          <option value="true"  ${user.is_active ? 'selected' : ''}>Yes</option>
          <option value="false" ${!user.is_active ? 'selected' : ''}>No</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="eu-btn">Save Changes</button>
      </div>
    </form>
  `);

  document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('eu-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api.updateUser(userId, {
        full_name:       document.getElementById('eu-name').value.trim(),
        phone:           document.getElementById('eu-phone').value.trim() || null,
        role:            document.getElementById('eu-role').value,
        organization_id: document.getElementById('eu-org').value || null,
        is_active:       document.getElementById('eu-active').value === 'true',
      });
      closeModal();
      toast('User updated', 'success');
      renderUsers();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Save Changes';
    }
  });
}

/* ===== Delete User ===== */
async function deleteUserById(id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  try {
    await api.deleteUser(id);
    toast('User deleted', 'success');
    renderUsers();
  } catch (err) {
    toast(err.message, 'error');
  }
}
