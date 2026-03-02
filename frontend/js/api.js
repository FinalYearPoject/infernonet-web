/* ===== API Client ===== */

const API_BASE = '/api';

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('infernonet_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('infernonet_token');
    localStorage.removeItem('infernonet_user');
    window.location.hash = '#/login';
    return null;
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = j.detail || JSON.stringify(j); } catch {}
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

const api = {
  /* Auth */
  login: (email, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  /* Organizations */
  getOrganizations: async () => {
    const r = await apiFetch('/organizations');
    return r?.organizations ?? r ?? [];
  },
  getOrganization: (id) => apiFetch(`/organizations/${id}`),
  createOrganization: (data) => apiFetch('/organizations', { method: 'POST', body: JSON.stringify(data) }),
  updateOrganization: (id, data) => apiFetch(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOrganization: (id) => apiFetch(`/organizations/${id}`, { method: 'DELETE' }),

  /* Users */
  getUsers: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await apiFetch(`/users${qs ? '?' + qs : ''}`);
    return r?.users ?? r ?? [];
  },
  getUser: (id) => apiFetch(`/users/${id}`),
  createUser: (data) => apiFetch('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id) => apiFetch(`/users/${id}`, { method: 'DELETE' }),

  /* Incidents */
  getIncidents: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await apiFetch(`/incidents${qs ? '?' + qs : ''}`);
    return r?.incidents ?? r ?? [];
  },
  getIncident: (id) => apiFetch(`/incidents/${id}`),
  createIncident: (data) => apiFetch('/incidents', { method: 'POST', body: JSON.stringify(data) }),
  updateIncident: (id, data) => apiFetch(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteIncident: (id) => apiFetch(`/incidents/${id}`, { method: 'DELETE' }),
  getIncidentUpdates: async (id) => {
    const r = await apiFetch(`/incidents/${id}/updates`);
    return r?.updates ?? r ?? [];
  },
  createIncidentUpdate: (id, data) => apiFetch(`/incidents/${id}/updates`, { method: 'POST', body: JSON.stringify(data) }),

  /* Teams */
  getTeams: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await apiFetch(`/teams${qs ? '?' + qs : ''}`);
    return r?.teams ?? r ?? [];
  },
  getTeam: (id) => apiFetch(`/teams/${id}`),
  getTeamMembers: async (id) => {
    const r = await apiFetch(`/teams/${id}/members`);
    return r?.members ?? r ?? [];
  },
  createTeam: (data) => apiFetch('/teams', { method: 'POST', body: JSON.stringify(data) }),
  updateTeam: (id, data) => apiFetch(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTeam: (id) => apiFetch(`/teams/${id}`, { method: 'DELETE' }),
  addTeamMember: (teamId, userId) =>
    apiFetch(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  removeTeamMember: (teamId, userId) => apiFetch(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),

  /* Equipment */
  getEquipment: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await apiFetch(`/equipment${qs ? '?' + qs : ''}`);
    return r?.equipment ?? r ?? [];
  },
  getEquipmentItem: (id) => apiFetch(`/equipment/${id}`),
  createEquipment: (data) => apiFetch('/equipment', { method: 'POST', body: JSON.stringify(data) }),
  updateEquipment: (id, data) => apiFetch(`/equipment/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEquipment: (id) => apiFetch(`/equipment/${id}`, { method: 'DELETE' }),

  /* Alerts */
  getAlerts: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await apiFetch(`/alerts${qs ? '?' + qs : ''}`);
    return r?.alerts ?? r ?? [];
  },
  createAlert: (data) => apiFetch('/alerts', { method: 'POST', body: JSON.stringify(data) }),
  deleteAlert: (id) => apiFetch(`/alerts/${id}`, { method: 'DELETE' }),

  /* Channels */
  getChannels: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const r = await apiFetch(`/channels${qs ? '?' + qs : ''}`);
    return r?.channels ?? r ?? [];
  },
  getChannel: (id) => apiFetch(`/channels/${id}`),
  createChannel: (data) => apiFetch('/channels', { method: 'POST', body: JSON.stringify(data) }),
  getChannelMembers: async (id) => {
    const r = await apiFetch(`/channels/${id}/members`);
    return r?.members ?? r ?? [];
  },
  addChannelMember: (id, userId) =>
    apiFetch(`/channels/${id}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  getMessages: async (channelId) => {
    const r = await apiFetch(`/channels/${channelId}/messages`);
    return r?.messages ?? r ?? [];
  },
  sendMessage: (channelId, content) =>
    apiFetch(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  editMessage: (channelId, messageId, content) =>
    apiFetch(`/channels/${channelId}/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
  deleteMessage: (channelId, messageId) =>
    apiFetch(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' }),
  updateChannel: (id, data) => apiFetch(`/channels/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteChannel: (id) => apiFetch(`/channels/${id}`, { method: 'DELETE' }),
  removeChannelMember: (channelId, userId) =>
    apiFetch(`/channels/${channelId}/members/${userId}`, { method: 'DELETE' }),
};
