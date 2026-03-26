(function () {
  const AUTH_STORAGE_KEY = 'purchaseSystem.auth.user';
  const AUTH_NOTICE_KEY = 'purchaseSystem.auth.notice';
  const AUTH_ACTIVITY_KEY = 'purchaseSystem.auth.lastActivity';
  const AUTH_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
  const AUTH_IDLE_CHECK_INTERVAL_MS = 15 * 1000;
  const AUTH_ACTIVITY_WRITE_INTERVAL_MS = 10 * 1000;
  const TECHNICIAN_ROLE = 'tecnico';

  let inactivityIntervalId = null;
  let activityEventsBound = false;

  function getApiBase() {
    return (location.protocol === 'file:' || location.port !== '3000')
      ? 'http://localhost:3000'
      : window.location.origin;
  }

  function normalizeRole(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function getSessionItem(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function setSessionItem(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      // Ignore storage access failures.
    }
  }

  function removeSessionItem(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      // Ignore storage access failures.
    }
  }

  function removeLegacyPersistentSession() {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      // Ignore storage access failures.
    }
  }

  function getStoredUser() {
    const raw = getSessionItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const normalizedUser = normalizeUser(JSON.parse(raw));
      if (!normalizedUser) {
        removeSessionItem(AUTH_STORAGE_KEY);
        return null;
      }
      return normalizedUser;
    } catch (error) {
      removeSessionItem(AUTH_STORAGE_KEY);
      return null;
    }
  }

  function getLastActivityTimestamp() {
    const raw = getSessionItem(AUTH_ACTIVITY_KEY);
    if (!raw) {
      return null;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }

  function setLastActivityTimestamp(timestamp) {
    setSessionItem(AUTH_ACTIVITY_KEY, String(timestamp));
  }

  function clearLastActivityTimestamp() {
    removeSessionItem(AUTH_ACTIVITY_KEY);
  }

  function isTechnicianUser(user) {
    const normalizedUser = normalizeUser(user);
    if (!normalizedUser) {
      return false;
    }

    return normalizeRole(normalizedUser.rol) === TECHNICIAN_ROLE;
  }

  function shouldExpireByInactivity(user) {
    const normalizedUser = normalizeUser(user);
    if (!normalizedUser) {
      return false;
    }

    return isTechnicianUser(normalizedUser);
  }

  function shouldSessionExpire(user, now) {
    if (!shouldExpireByInactivity(user)) {
      return false;
    }

    const lastActivity = getLastActivityTimestamp();
    if (!lastActivity) {
      return false;
    }

    return now - lastActivity >= AUTH_IDLE_TIMEOUT_MS;
  }

  function stopInactivityTimer() {
    if (inactivityIntervalId !== null) {
      window.clearInterval(inactivityIntervalId);
      inactivityIntervalId = null;
    }
  }

  function touchActivity(forceWrite) {
    const currentUser = getStoredUser();
    if (!currentUser || !shouldExpireByInactivity(currentUser)) {
      return;
    }

    const now = Date.now();
    const lastActivity = getLastActivityTimestamp();

    if (!forceWrite && lastActivity && (now - lastActivity) < AUTH_ACTIVITY_WRITE_INTERVAL_MS) {
      return;
    }

    setLastActivityTimestamp(now);
  }

  function expireSessionByInactivity() {
    setNotice('Tu sesion se cerro por inactividad. Escanea tu QR para ingresar nuevamente.');
    clearUser();
    window.location.replace('index.html');
  }

  function checkSessionInactivity() {
    const currentUser = getStoredUser();
    if (!currentUser) {
      stopInactivityTimer();
      return;
    }

    if (!shouldExpireByInactivity(currentUser)) {
      clearLastActivityTimestamp();
      stopInactivityTimer();
      return;
    }

    const now = Date.now();
    const lastActivity = getLastActivityTimestamp();

    if (!lastActivity) {
      setLastActivityTimestamp(now);
      return;
    }

    if ((now - lastActivity) >= AUTH_IDLE_TIMEOUT_MS) {
      expireSessionByInactivity();
    }
  }

  function bindActivityEvents() {
    if (activityEventsBound || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown'];
    const onActivity = function () {
      touchActivity(false);
    };

    activityEvents.forEach(function (eventName) {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        touchActivity(true);
      }
    });

    activityEventsBound = true;
  }

  function syncInactivityMonitor(user) {
    if (!user || !shouldExpireByInactivity(user)) {
      clearLastActivityTimestamp();
      stopInactivityTimer();
      return;
    }

    bindActivityEvents();
    touchActivity(true);

    if (inactivityIntervalId === null) {
      inactivityIntervalId = window.setInterval(checkSessionInactivity, AUTH_IDLE_CHECK_INTERVAL_MS);
    }
  }

  function normalizeUser(user) {
    if (!user || typeof user !== 'object') {
      return null;
    }

    const pid = String(user.pid || '').trim();
    const rol = String(user.rol || user.role || '').trim();
    const userName = String(user.user_name || user.userName || '').trim();
    const lastName = String(user.last_name || user.lastName || '').trim();

    if (!pid || !rol) {
      return null;
    }

    return {
      pid,
      rol,
      role: rol,
      user_name: userName,
      last_name: lastName
    };
  }

  function getUserDisplayName(user) {
    const normalizedUser = normalizeUser(user);
    if (!normalizedUser) {
      return '-';
    }

    const fullName = [normalizedUser.user_name, normalizedUser.last_name]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ');

    return fullName || normalizedUser.pid || '-';
  }

  function getUser() {
    removeLegacyPersistentSession();

    const currentUser = getStoredUser();
    if (!currentUser) {
      stopInactivityTimer();
      return null;
    }

    if (shouldSessionExpire(currentUser, Date.now())) {
      clearUser();
      return null;
    }

    if (shouldExpireByInactivity(currentUser) && !getLastActivityTimestamp()) {
      setLastActivityTimestamp(Date.now());
    }

    syncInactivityMonitor(currentUser);
    return currentUser;
  }

  function setUser(user) {
    const normalizedUser = normalizeUser(user);
    if (!normalizedUser) {
      throw new Error('Usuario invalido para sesion.');
    }

    removeLegacyPersistentSession();
    setSessionItem(AUTH_STORAGE_KEY, JSON.stringify(normalizedUser));

    if (shouldExpireByInactivity(normalizedUser)) {
      setLastActivityTimestamp(Date.now());
    } else {
      clearLastActivityTimestamp();
    }

    syncInactivityMonitor(normalizedUser);
    return normalizedUser;
  }

  function clearUser() {
    removeSessionItem(AUTH_STORAGE_KEY);
    clearLastActivityTimestamp();
    removeLegacyPersistentSession();
    stopInactivityTimer();
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

    setSessionItem(AUTH_NOTICE_KEY, String(message));
  }

  function consumeNotice() {
    const message = getSessionItem(AUTH_NOTICE_KEY);
    if (message) {
      removeSessionItem(AUTH_NOTICE_KEY);
    }
    return message;
  }

  function isIndexPage() {
    const path = window.location.pathname.toLowerCase();
    return path === '/' || path.endsWith('/index.html');
  }

  function shouldHandlePageTransitionClick(event, link) {
    if (!event || !link) {
      return false;
    }

    if (event.defaultPrevented) {
      return false;
    }

    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return false;
    }

    const rawHref = String(link.getAttribute('href') || '').trim();
    if (!rawHref || rawHref === '#' || rawHref.startsWith('#')) {
      return false;
    }

    if (link.hasAttribute('download') || String(link.getAttribute('target') || '').toLowerCase() === '_blank') {
      return false;
    }

    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) {
      return false;
    }

    let targetUrl;
    try {
      targetUrl = new URL(link.href, window.location.href);
    } catch (error) {
      return false;
    }

    if (targetUrl.origin !== window.location.origin) {
      return false;
    }

    if (targetUrl.href === window.location.href) {
      return false;
    }

    return true;
  }

  function initPageTransitions() {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
      return;
    }

    const body = document.body;
    body.classList.add('page-transition');

    const rootStyles = window.getComputedStyle(document.documentElement);
    const rawDuration = Number.parseInt(rootStyles.getPropertyValue('--page-transition-duration-ms'), 10);
    const transitionDurationMs = Number.isFinite(rawDuration) && rawDuration >= 0 ? rawDuration : 170;
    const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    document.addEventListener('click', function (event) {
      const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!shouldHandlePageTransitionClick(event, link)) {
        return;
      }

      event.preventDefault();

      const destination = link.href;

      if (reduceMotionQuery && reduceMotionQuery.matches) {
        window.location.assign(destination);
        return;
      }

      body.classList.add('page-transition-exit');

      window.setTimeout(function () {
        window.location.assign(destination);
      }, transitionDurationMs);
    });
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

  async function validateCredentials(userName, password) {
    const normalizedUserName = String(userName || '').trim();
    const normalizedPassword = String(password || '').trim();

    if (!normalizedUserName) {
      throw new Error('User name es requerido');
    }

    if (!normalizedPassword) {
      throw new Error('Password es requerido');
    }

    const response = await fetch(`${getApiBase()}/api/auth/validate-credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_name: normalizedUserName, user_password: normalizedPassword })
    });

    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }

    if (!response.ok || !data.success || !data.user) {
      throw new Error(data.error || 'Acceso denegado. Usuario o contraseña incorrectos.');
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
      pidLabel.textContent = getUserDisplayName(user);
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
      pidLabel.textContent = getUserDisplayName(user);
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

  async function refreshUserProfileIfNeeded(user) {
    const normalizedUser = normalizeUser(user);
    if (!normalizedUser) {
      return null;
    }

    if (normalizedUser.user_name || normalizedUser.last_name) {
      return normalizedUser;
    }

    try {
      return await validateQr(normalizedUser.pid);
    } catch (error) {
      return normalizedUser;
    }
  }

  async function autoMountUserInfoBar() {
    const currentUser = getUser();
    if (!currentUser) {
      return;
    }

    const hydratedUser = await refreshUserProfileIfNeeded(currentUser);
    mountUserInfoBar({ user: hydratedUser, bindExistingLogout: false });
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        initPageTransitions();
        autoMountUserInfoBar();
      });
    } else {
      initPageTransitions();
      autoMountUserInfoBar();
    }
  }

  window.PurchaseAuth = Object.freeze({
    apiBase: getApiBase,
    getUser,
    setUser,
    clearUser,
    getUserDisplayName,
    hasAnyRole,
    validateQr,
    validateCredentials,
    requireAuth,
    consumeNotice,
    logout,
    mountUserInfoBar,
    refreshUserProfileIfNeeded
  });
})();
