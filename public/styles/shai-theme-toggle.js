/* ============================================================================
   SHAI Theme Toggle
   - Reads/writes localStorage key 'shai-theme' (light|dark)
   - Sets data-theme on <html>
   - Renders an inline pill toggle when given a target element
   - FOUC prevention: a tiny inline script in each page's <head> applies the
     stored theme BEFORE this file loads or any rendering happens.
   ============================================================================ */
(function () {
  const KEY = 'shai-theme';

  function getTheme() {
    try { return localStorage.getItem(KEY) || 'light'; } catch (e) { return 'light'; }
  }
  function setTheme(t) {
    try { localStorage.setItem(KEY, t); } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
    syncToggles();
    // Notify listeners (charts, canvases, etc. that may need to redraw)
    document.dispatchEvent(new CustomEvent('shai-theme-changed', { detail: { theme: t } }));
  }
  function syncToggles() {
    const t = getTheme();
    document.querySelectorAll('.shai-theme-toggle').forEach(el => {
      el.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === t);
      });
    });
  }
  function renderInto(target) {
    if (!target) return;
    target.classList.add('shai-theme-toggle');
    target.innerHTML =
      '<button data-theme="light" title="Light mode" aria-label="Light mode">☀ Light</button>' +
      '<button data-theme="dark"  title="Dark mode"  aria-label="Dark mode">☾ Dark</button>';
    target.addEventListener('click', e => {
      const btn = e.target.closest('button[data-theme]');
      if (btn) setTheme(btn.dataset.theme);
    });
    syncToggles();
  }

  // Public API
  window.SHAITheme = {
    get: getTheme,
    set: setTheme,
    renderInto: renderInto,
    init: function () {
      // Auto-mount: any element with class .shai-theme-toggle and empty content gets rendered
      document.querySelectorAll('.shai-theme-toggle').forEach(el => {
        if (!el.querySelector('button')) renderInto(el);
      });
      syncToggles();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.SHAITheme.init);
  } else {
    window.SHAITheme.init();
  }
})();
