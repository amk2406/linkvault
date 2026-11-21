/**
 * LinkVault Mobile Slide Sidebar
 * DeepSeek-style off-canvas sidebar for phones & small screens
 * 
 * Usage: just include this script. It auto-detects .sidebar
 */

(function () {
  'use strict';

  const BREAKPOINT = 900; // px – change if you want
  const SIDEBAR_SELECTOR = '.sidebar';
  const TOGGLE_ID = 'sidebar-toggle';
  const OVERLAY_ID = 'sidebar-overlay';

  let sidebar, overlay, toggleBtn;
  let isOpen = false;

  // ---------- Helpers ----------
  function isMobile() {
    return window.innerWidth < BREAKPOINT;
  }

  function createToggleButton() {
    if (document.getElementById(TOGGLE_ID)) return;

    const btn = document.createElement('button');
    btn.id = TOGGLE_ID;
    btn.className = 'sidebar-toggle';
    btn.setAttribute('aria-label', 'Toggle menu');
    btn.innerHTML = `
      <span class="toggle-icon">
        <span></span>
        <span></span>
        <span></span>
      </span>
    `;

    // Insert into header (prefer .header-inner or .header)
    const header = document.querySelector('.header-inner') || document.querySelector('.header');
    if (header) {
      header.insertBefore(btn, header.firstChild);
    } else {
      document.body.prepend(btn);
    }

    btn.addEventListener('click', toggleSidebar);
    return btn;
  }

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'sidebar-overlay';
    document.body.appendChild(el);

    el.addEventListener('click', closeSidebar);
    return el;
  }

  function openSidebar() {
    if (!isMobile() || isOpen) return;
    isOpen = true;

    sidebar.classList.add('is-open');
    overlay.classList.add('is-visible');
    document.body.classList.add('sidebar-open');
    toggleBtn?.classList.add('is-active');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    if (!isOpen) return;
    isOpen = false;

    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-visible');
    document.body.classList.remove('sidebar-open');
    toggleBtn?.classList.remove('is-active');

    document.body.style.overflow = '';
  }

  function toggleSidebar() {
    isOpen ? closeSidebar() : openSidebar();
  }

  // ---------- Init ----------
  function init() {
    sidebar = document.querySelector(SIDEBAR_SELECTOR);
    if (!sidebar) return;

    overlay = createOverlay();
    toggleBtn = createToggleButton();

    // Close when a sidebar link is clicked (good UX on mobile)
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (isMobile()) closeSidebar();
      });
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeSidebar();
    });

    // Handle resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!isMobile() && isOpen) {
          closeSidebar();
        }
      }, 100);
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();