(function () {
  const AUTH_STORAGE_KEY = 'purchaseSystem.auth.user';
  const AUTH_NOTICE_KEY = 'purchaseSystem.auth.notice';

  function getApiBase() {
    return (location.protocol === 'file:' || location.port !== '3000')
      ? 'http://localhost:3000'
      : window.location.origin;
  }

  function normalizeRole(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeUser(user) {
    if (!user || typeof user !== 'object') {
      return null;
    }

    const pid = String(user.pid || '').trim();
    const rol = String(user.rol || user.role || '').trim();

    if (!pid || !rol) {
      return null;
    }

    return {
      pid,
      rol,
      role: rol
    };
  }

  function getUser() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return normalizeUser(JSON.parse(raw));
    } catch (error) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  }

  function setUser(user) {
    const normalizedUser = normalizeUser(user);
    if (!normalizedUser) {
      throw new Error('Usuario invalido para sesion.');
    }

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalizedUser));
    return normalizedUser;
  }

  function clearUser() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  function hasAnyRole(user, roles) {
    if (!Array.isArray(roles) || roles.length === 0) {
      return true;
    }

    const normalizedUser = normalizeUser(user);
    if (!normalizedUser) {
      return false;
    }

    const userRole = normalizeRole(normalizedUser.rol);
    return roles.some((role) => normalizeRole(role) === userRole);
  }

  function setNotice(message) {
    if (!message) {
      return;
    }

    sessionStorage.setItem(AUTH_NOTICE_KEY, String(message));
  }

  function consumeNotice() {
    const message = sessionStorage.getItem(AUTH_NOTICE_KEY);
    if (message) {
      sessionStorage.removeItem(AUTH_NOTICE_KEY);
    }
    return message;
  }

  function isIndexPage() {
    const path = window.location.pathname.toLowerCase();
    return path === '/' || path.endsWith('/index.html');
  }

  function redirectToLogin(message, redirectTo) {
    const target = redirectTo || 'index.html';
    setNotice(message);

    if (!isIndexPage()) {
      window.location.replace(target);
    }
  }

  async function validateQr(pid) {
    const normalizedPid = String(pid || '').trim();

    if (!normalizedPid) {
      throw new Error('PID es requerido');
    }

    const response = await fetch(`${getApiBase()}/api/auth/validate-qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pid: normalizedPid })
    });

    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }

    if (!response.ok || !data.success || !data.user) {
      throw new Error(data.error || 'Acceso denegado. Usuario no encontrado o sin permisos.');
    }

    return setUser(data.user);
  }

  function requireAuth(options) {
    const config = options || {};
    const currentUser = getUser();

    if (!currentUser) {
      redirectToLogin(
        config.loginMessage || 'Escanea tu QR para ingresar al sistema.',
        config.redirectTo
      );
      return null;
    }

    if (Array.isArray(config.allowedRoles) && config.allowedRoles.length > 0) {
      const hasRoleAccess = hasAnyRole(currentUser, config.allowedRoles);
      if (!hasRoleAccess) {
        redirectToLogin(
          config.deniedMessage || 'No tienes permisos para acceder a esta seccion.',
          config.redirectTo
        );
        return null;
      }
    }

    return currentUser;
  }

  function logout(redirectTo) {
    clearUser();
    window.location.replace(redirectTo || 'index.html');
  }

  function bindLogoutButton(button) {
    if (!button || button.dataset.authBound === '1') {
      return;
    }

    button.dataset.authBound = '1';
    button.addEventListener('click', function () {
      logout('index.html');
    });
  }

  function getPagePidLabel(userInfoBar) {
    return (
      document.getElementById('pid') ||
      document.getElementById('loggedPid') ||
      userInfoBar.querySelector('[data-auth-pid]')
    );
  }

  function getPageRolLabel(userInfoBar) {
    return (
      document.getElementById('rol') ||
      document.getElementById('loggedRol') ||
      userInfoBar.querySelector('[data-auth-rol]')
    );
  }

  function updateExistingUserInfoBar(user, config) {
    const userInfoBar = document.getElementById('userInfoBar');
    if (!userInfoBar) {
      return false;
    }

    const pidLabel = getPagePidLabel(userInfoBar);
    const rolLabel = getPageRolLabel(userInfoBar);

    if (pidLabel) {
      pidLabel.textContent = user.pid || '-';
    }

    if (rolLabel) {
      rolLabel.textContent = user.rol || user.role || '-';
    }

    userInfoBar.style.display = 'flex';

    if (config && config.bindExistingLogout) {
      const logoutButton = document.getElementById('logoutBtn') || userInfoBar.querySelector('.logout-btn');
      bindLogoutButton(logoutButton);
    }

    return true;
  }

  function createGlobalUserInfoBar(user) {
    let userInfoBar = document.getElementById('globalUserInfoBar');

    if (!userInfoBar) {
      userInfoBar = document.createElement('div');
      userInfoBar.id = 'globalUserInfoBar';
      userInfoBar.className = 'user-info-bar';
      userInfoBar.innerHTML = [
        '<div class="user-details">',
        '  <i class="bi bi-person-circle fs-5"></i>',
        '  <span data-auth-pid>User</span>',
        '  <span class="user-badge" data-auth-rol>Role</span>',
        '</div>',
        '<button class="logout-btn" type="button">',
        '  <i class="bi bi-box-arrow-right me-1"></i>Logout',
        '</button>'
      ].join('');
      document.body.insertBefore(userInfoBar, document.body.firstChild);
    }

    const pidLabel = userInfoBar.querySelector('[data-auth-pid]');
    const rolLabel = userInfoBar.querySelector('[data-auth-rol]');
    const logoutButton = userInfoBar.querySelector('.logout-btn');

    if (pidLabel) {
      pidLabel.textContent = user.pid || '-';
    }

    if (rolLabel) {
      rolLabel.textContent = user.rol || user.role || '-';
    }

    bindLogoutButton(logoutButton);
    userInfoBar.style.display = 'flex';
    return userInfoBar;
  }

  function mountUserInfoBar(options) {
    const config = options || {};
    const currentUser = normalizeUser(config.user || getUser());

    if (!currentUser || typeof document === 'undefined' || !document.body) {
      return null;
    }

    if (Array.isArray(config.allowedRoles) && config.allowedRoles.length > 0 && !hasAnyRole(currentUser, config.allowedRoles)) {
      return null;
    }

    if (updateExistingUserInfoBar(currentUser, config)) {
      return currentUser;
    }

    createGlobalUserInfoBar(currentUser);
    return currentUser;
  }

  function autoMountUserInfoBar() {
    const currentUser = getUser();
    if (!currentUser) {
      return;
    }

    mountUserInfoBar({ user: currentUser, bindExistingLogout: false });
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoMountUserInfoBar);
    } else {
      autoMountUserInfoBar();
    }
  }

  window.PurchaseAuth = Object.freeze({
    apiBase: getApiBase,
    getUser,
    setUser,
    clearUser,
    hasAnyRole,
    validateQr,
    requireAuth,
    consumeNotice,
    logout,
    mountUserInfoBar
  });
})();
