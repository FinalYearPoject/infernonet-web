/* ===== Auth helpers ===== */

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('infernonet_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isAuthenticated() {
  return !!localStorage.getItem('infernonet_token');
}

async function login(email, password) {
  const data = await api.login(email, password);
  if (!data) return false;
  localStorage.setItem('infernonet_token', data.access_token);
  localStorage.setItem('infernonet_user', JSON.stringify({
    id: data.user_id,
    email: data.email,
    role: data.role,
  }));
  return true;
}

function logout() {
  localStorage.removeItem('infernonet_token');
  localStorage.removeItem('infernonet_user');
  updateHeader();
  window.location.hash = '#/login';
}

function updateHeader() {
  const header = document.getElementById('app-header');
  const userInfo = document.getElementById('nav-user-info');
  const user = getCurrentUser();

  if (!header || !userInfo) return;

  if (user) {
    header.style.display = 'flex';
    userInfo.textContent = `${user.email} · ${user.role}`;
  } else {
    header.style.display = 'none';
    userInfo.textContent = '';
  }

  /* highlight active nav link */
  const hash = window.location.hash.replace('#/', '');
  document.querySelectorAll('.nav-link').forEach(link => {
    const route = link.dataset.route;
    link.classList.toggle('active', hash.startsWith(route));
  });
}

document.getElementById('btn-logout')?.addEventListener('click', logout);
