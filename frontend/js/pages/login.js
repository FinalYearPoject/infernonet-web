/* ===== Login Page ===== */

function renderLogin() {
  document.getElementById('app-header').style.display = 'none';

  mount(`
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">
          <span class="logo-icon">🔥</span>
          <h1>InfernoNet</h1>
          <p>Smart communication for fire emergencies</p>
        </div>

        <div class="login-tabs">
          <button class="login-tab active" id="tab-login" onclick="switchLoginTab('login')">Sign In</button>
          <button class="login-tab" id="tab-register" onclick="switchLoginTab('register')">Register</button>
        </div>

        <div class="login-error" id="login-error"></div>

        <!-- Sign In form -->
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              class="form-control"
              placeholder="you@organization.com"
              autocomplete="email"
              required
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              class="form-control"
              placeholder="••••••••"
              autocomplete="current-password"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px" id="login-btn">
            Sign in
          </button>
        </form>

        <!-- Register form (hidden by default) -->
        <form id="register-form" style="display:none">
          <div class="form-group">
            <label class="form-label" for="reg-name">Full Name *</label>
            <input id="reg-name" type="text" class="form-control" placeholder="Jane Smith" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-email">Email *</label>
            <input id="reg-email" type="email" class="form-control" placeholder="you@organization.com" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-password">Password *</label>
            <input id="reg-password" type="password" class="form-control" placeholder="Min. 6 characters" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-phone">Phone</label>
            <input id="reg-phone" type="text" class="form-control" placeholder="+1 555 000 000" />
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-role">Role *</label>
            <select id="reg-role" class="form-control" required>
              <option value="">Select your role…</option>
              <option value="firefighter">Firefighter</option>
              <option value="coordinator">Coordinator</option>
              <option value="civilian">Civilian</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px" id="reg-btn">
            Create account
          </button>
        </form>
      </div>
    </div>
  `);

  /* Tab switcher */
  window.switchLoginTab = function(tab) {
    const isLogin = tab === 'login';
    document.getElementById('login-form').style.display    = isLogin ? '' : 'none';
    document.getElementById('register-form').style.display = isLogin ? 'none' : '';
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);
    document.getElementById('login-error').style.display = 'none';
  };

  /* Sign In */
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    const btn      = document.getElementById('login-btn');

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in…';

    try {
      const ok = await login(email, password);
      if (ok) {
        window.location.hash = '#/incidents';
      } else {
        errEl.textContent = 'Invalid email or password.';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = err.message || 'Login failed. Please try again.';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  /* Register */
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    const btn   = document.getElementById('reg-btn');

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account…';

    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
      await api.createUser({
        full_name: document.getElementById('reg-name').value.trim(),
        email,
        password,
        phone:     document.getElementById('reg-phone').value.trim() || null,
        role:      document.getElementById('reg-role').value,
      });
      /* Auto-login after successful registration */
      const ok = await login(email, password);
      if (ok) {
        toast('Account created — welcome!', 'success');
        window.location.hash = '#/incidents';
      }
    } catch (err) {
      errEl.textContent = err.message || 'Registration failed. Please try again.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  });
}
