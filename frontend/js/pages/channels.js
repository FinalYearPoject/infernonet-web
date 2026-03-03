/* ===== Channel Message Thread ===== */

let _channelPollTimer = null;

async function renderChannel(channelId) {
  if (_channelPollTimer) { clearInterval(_channelPollTimer); _channelPollTimer = null; }

  mount(`<div class="page"><div class="loading-state"><span class="spinner"></span> Loading channel…</div></div>`);

  let channel, members, messages, users;
  try {
    [channel, members, messages, users] = await Promise.all([
      api.getChannel(channelId),
      api.getChannelMembers(channelId),
      api.getMessages(channelId),
      api.getUsers(),
    ]);
  } catch (err) {
    mount(`<div class="page"><div class="empty-state"><span class="empty-icon">⚠️</span>${err.message}</div></div>`);
    return;
  }

  if (!channel) return;

  const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
  const currentUser = getCurrentUser();
  const isCoordinator = currentUser?.role === 'coordinator';

  function buildMessages(msgs) {
    if (!msgs || !msgs.length) {
      return `<div class="empty-state"><span class="empty-icon">💬</span>No messages yet. Be the first to write!</div>`;
    }
    return msgs.map(m => {
      const author = userMap[m.user_id];
      const initials = author
        ? author.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : '?';
      const name = author ? author.full_name : (m.user_id ? m.user_id.slice(0, 8) + '…' : 'System');
      const isOwn = currentUser && m.user_id === currentUser.id;
      const canEdit = isOwn;
      const canDelete = isOwn || isCoordinator;

      return `
        <div class="message-item" id="msg-${m.id}">
          <div class="message-avatar">${initials}</div>
          <div class="message-body">
            <div class="message-meta">
              <span class="message-author">${name}</span>
              <span class="message-time">${fmtDate(m.created_at)}</span>
              ${m.edited_at ? '<span class="message-edited">(edited)</span>' : ''}
              <span class="message-actions">
                ${canEdit ? `<button class="btn-inline" onclick="startEditMessage('${channelId}','${m.id}')">✏️</button>` : ''}
                ${canDelete ? `<button class="btn-inline" onclick="deleteMsg('${channelId}','${m.id}')">🗑️</button>` : ''}
              </span>
            </div>
            <div class="message-text" id="msg-text-${m.id}">${escapeHtml(m.content)}</div>
          </div>
        </div>`;
    }).join('');
  }

  function buildMemberChips(mems) {
    if (!mems || !mems.length) return '<span style="color:var(--text-muted);font-size:13px">No members yet</span>';
    return mems.map(m => {
      const u = userMap[m.user_id];
      const label = u ? u.full_name : m.user_id.slice(0, 8) + '…';
      return `
        <span class="chip">
          ${label} <span style="color:var(--text-muted)">(${u?.role || ''})</span>
          ${isCoordinator ? `<button class="chip-remove" onclick="removeChannelMemberById('${channelId}','${m.user_id}')">×</button>` : ''}
        </span>`;
    }).join('');
  }

  mount(`
    <div class="page">
      <div class="back-btn" id="ch-back-btn">← Back</div>

      <div class="page-header">
        <div>
          <div class="page-title"># ${channel.name}</div>
          <div class="page-subtitle">
            ${channel.is_public ? 'Public' : 'Private'} channel
            ${channel.incident_id ? `· Incident ${channel.incident_id.slice(0, 8)}…` : ''}
          </div>
        </div>
        ${currentUser?.role !== 'civilian' ? `<button class="btn btn-secondary btn-sm" id="btn-add-member">+ Add Member</button>` : ''}
      </div>

      <!-- Messages -->
      <div class="card">
        <div class="card-title"><span class="card-icon">💬</span> Messages</div>
        <div class="message-thread" id="message-thread">
          ${buildMessages(messages)}
        </div>
        <div class="message-input-row">
          <input
            class="form-control"
            id="msg-input"
            placeholder="Type a message and press Enter…"
            autocomplete="off"
          />
          <button class="btn btn-primary" id="btn-send-msg">Send</button>
        </div>
      </div>
    </div>
  `);

  /* Back button */
  document.getElementById('ch-back-btn').addEventListener('click', () => {
    if (channel.incident_id) {
      window.location.hash = `#/incidents/${channel.incident_id}`;
    } else {
      window.location.hash = '#/incidents';
    }
  });

  /* Scroll to bottom */
  function scrollBottom() {
    const t = document.getElementById('message-thread');
    if (t) t.scrollTop = t.scrollHeight;
  }
  scrollBottom();

  /* Send message */
  async function sendMessage() {
    const input = document.getElementById('msg-input');
    const btn   = document.getElementById('btn-send-msg');
    const content = input.value.trim();
    if (!content) return;

    input.disabled = true; btn.disabled = true;
    try {
      await api.sendMessage(channelId, content);
      input.value = '';
      await refreshMessages();
      scrollBottom();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      input.disabled = false; btn.disabled = false;
      input.focus();
    }
  }

  document.getElementById('btn-send-msg').addEventListener('click', sendMessage);
  document.getElementById('msg-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  /* Poll for new messages every 5s */
  async function refreshMessages() {
    const thread = document.getElementById('message-thread');
    if (!thread) { clearInterval(_channelPollTimer); return; }
    try {
      const msgs = await api.getMessages(channelId);
      if (msgs) {
        const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 60;
        thread.innerHTML = buildMessages(msgs);
        if (atBottom) thread.scrollTop = thread.scrollHeight;
      }
    } catch {}
  }
  _channelPollTimer = setInterval(refreshMessages, 5000);

  /* Add member modal — non-civilian only */
  document.getElementById('btn-add-member')?.addEventListener('click', async () => {
    const memberIds = new Set((members || []).map(m => m.user_id));
    const eligible = (users || []).filter(u => !memberIds.has(u.id));
    const userOptions = eligible
      .map(u => `<option value="${u.id}">${u.full_name} (${u.role})</option>`)
      .join('');

    openModal('Add Channel Member', `
      <form id="add-member-form">
        <div class="form-group">
          <label class="form-label">Select User *</label>
          <select class="form-control" id="add-member-user" required>
            <option value="">Choose…</option>
            ${userOptions || '<option disabled>All users already added</option>'}
          </select>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="add-member-btn">Add</button>
        </div>
      </form>
    `);

    document.getElementById('add-member-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('add-member-btn');
      btn.disabled = true; btn.textContent = 'Adding…';
      try {
        const userId = document.getElementById('add-member-user').value;
        await api.addChannelMember(channelId, userId);
        closeModal();
        toast('Member added', 'success');
        members = await api.getChannelMembers(channelId);
        const chips = document.getElementById('member-chips');
        if (chips) chips.innerHTML = buildMemberChips(members);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = 'Add';
      }
    });
  });
}

/* ===== Edit message inline ===== */
function startEditMessage(channelId, messageId) {
  const textEl = document.getElementById(`msg-text-${messageId}`);
  if (!textEl) return;
  const current = textEl.textContent;

  textEl.innerHTML = `
    <div style="display:flex;gap:8px;margin-top:4px">
      <input class="form-control" id="edit-msg-input-${messageId}" value="${escapeAttr(current)}" style="flex:1" />
      <button class="btn btn-primary btn-sm" onclick="saveEditMessage('${channelId}','${messageId}')">Save</button>
      <button class="btn btn-secondary btn-sm" onclick="cancelEditMessage('${messageId}','${escapeAttr(current)}')">Cancel</button>
    </div>`;
  document.getElementById(`edit-msg-input-${messageId}`)?.focus();
}

async function saveEditMessage(channelId, messageId) {
  const input = document.getElementById(`edit-msg-input-${messageId}`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  try {
    await api.editMessage(channelId, messageId, content);
    toast('Message edited', 'success');
    /* Refresh to get updated content */
    const msgs = await api.getMessages(channelId);
    const thread = document.getElementById('message-thread');
    if (thread && msgs) {
      const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 60;
      const currentUser = getCurrentUser();
      const users = await api.getUsers();
      const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
      const isCoordinator = currentUser?.role === 'coordinator';

      function buildMsgs(ms) {
        return ms.map(m => {
          const author = userMap[m.user_id];
          const initials = author ? author.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?';
          const name = author ? author.full_name : (m.user_id ? m.user_id.slice(0,8)+'…' : 'System');
          const isOwn = currentUser && m.user_id === currentUser.id;
          return `
            <div class="message-item" id="msg-${m.id}">
              <div class="message-avatar">${initials}</div>
              <div class="message-body">
                <div class="message-meta">
                  <span class="message-author">${name}</span>
                  <span class="message-time">${fmtDate(m.created_at)}</span>
                  ${m.edited_at ? '<span class="message-edited">(edited)</span>' : ''}
                  <span class="message-actions">
                    ${isOwn ? `<button class="btn-inline" onclick="startEditMessage('${channelId}','${m.id}')">✏️</button>` : ''}
                    ${(isOwn || isCoordinator) ? `<button class="btn-inline" onclick="deleteMsg('${channelId}','${m.id}')">🗑️</button>` : ''}
                  </span>
                </div>
                <div class="message-text" id="msg-text-${m.id}">${escapeHtml(m.content)}</div>
              </div>
            </div>`;
        }).join('');
      }
      thread.innerHTML = buildMsgs(msgs);
      if (atBottom) thread.scrollTop = thread.scrollHeight;
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

function cancelEditMessage(messageId, original) {
  const textEl = document.getElementById(`msg-text-${messageId}`);
  if (textEl) textEl.innerHTML = escapeHtml(original);
}

/* ===== Delete message ===== */
async function deleteMsg(channelId, messageId) {
  if (!confirm('Delete this message?')) return;
  try {
    await api.deleteMessage(channelId, messageId);
    const el = document.getElementById(`msg-${messageId}`);
    if (el) el.remove();
    toast('Message deleted', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ===== Remove channel member ===== */
async function removeChannelMemberById(channelId, userId) {
  if (!confirm('Remove this member from the channel?')) return;
  try {
    await api.removeChannelMember(channelId, userId);
    toast('Member removed', 'success');
    /* Re-render the chips */
    const members = await api.getChannelMembers(channelId);
    const users = await api.getUsers();
    const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
    const chips = document.getElementById('member-chips');
    if (chips) {
      chips.innerHTML = (members || []).map(m => {
        const u = userMap[m.user_id];
        return `
          <span class="chip">
            ${u ? u.full_name : m.user_id.slice(0,8)+'…'}
            <span style="color:var(--text-muted)">(${u?.role || ''})</span>
            <button class="chip-remove" onclick="removeChannelMemberById('${channelId}','${m.user_id}')">×</button>
          </span>`;
      }).join('') || '<span style="color:var(--text-muted);font-size:13px">No members</span>';
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ===== HTML escape helpers ===== */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
