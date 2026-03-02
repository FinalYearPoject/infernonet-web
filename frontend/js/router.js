/* ===== Hash-based SPA Router ===== */

const routes = [
  { pattern: /^\/login$/,              render: renderLogin },
  { pattern: /^\/incidents$/,          render: renderIncidents },
  { pattern: /^\/incidents\/(.+)$/,    render: (m) => renderIncidentDetail(m[1]) },
  { pattern: /^\/users$/,              render: renderUsers },
  { pattern: /^\/channels\/(.+)$/,     render: (m) => renderChannel(m[1]) },
  { pattern: /^\/equipment$/,          render: renderEquipment },
  { pattern: /^\/map$/,                render: renderMap },
  { pattern: /^\/organizations$/,      render: renderOrganizations },
];

function resolveHash() {
  const hash = window.location.hash.replace(/^#/, '') || '/incidents';

  /* auth guard — redirect to login if not logged in */
  if (!isAuthenticated() && hash !== '/login') {
    window.location.hash = '#/login';
    return;
  }
  /* civilians: only Incidents and Live Map */
  const user = getCurrentUser();
  if (user?.role === 'civilian' && ['/users', '/organizations', '/equipment'].includes(hash)) {
    window.location.hash = '#/incidents';
    return;
  }
  /* already logged in, redirect away from login */
  if (isAuthenticated() && hash === '/login') {
    window.location.hash = '#/incidents';
    return;
  }

  updateHeader();

  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      route.render(match);
      return;
    }
  }

  /* fallback */
  window.location.hash = isAuthenticated() ? '#/incidents' : '#/login';
}

/* ===== Modal helpers ===== */
function openModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  if (window._incidentFormMap) {
    window._incidentFormMap.remove();
    window._incidentFormMap = null;
  }
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('modal-body').innerHTML = '';
}

document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

/* ===== Utility: mount into #app ===== */
function mount(html) {
  document.getElementById('app').innerHTML = html;
}

/* ===== Utility: format date ===== */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ===== Utility: badge HTML ===== */
function badge(value, prefix = '') {
  if (!value) return '—';
  const cls = prefix ? `badge-${prefix}-${value}` : `badge-${value}`;
  return `<span class="badge ${cls}">${value}</span>`;
}

/* ===== Boot ===== */
window.addEventListener('hashchange', resolveHash);
window.addEventListener('DOMContentLoaded', resolveHash);
