// theme.js
  const STORAGE_KEY = 'theme';
  const DARK_CLASS = 'dark';

  const html = document.body;
  // Get saved theme or system preference
  function getPreferredTheme() {
    //const saved = localStorage.getItem(STORAGE_KEY);
    //if (saved === 'dark' || saved === 'light') {
      //return saved;
   // }
    // Fallback to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  // Apply theme
  function applyTheme(theme) {
    if (theme === 'dark') {
      html.classList.add(DARK_CLASS);
    } else {
      html.classList.remove(DARK_CLASS);
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }

  // Toggle theme
  function toggleTheme() {
    const isDark = html.classList.contains(DARK_CLASS);
    applyTheme(isDark ? 'light' : 'dark');
  }

  // Initialize on page load
  applyTheme(getPreferredTheme());

  // Optional: Listen to system theme changes (only if user hasn't manually chosen)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Expose functions globally (optional)
  window.theme = {
    toggle: toggleTheme,
    set: applyTheme,
    get: () => (html.classList.contains(DARK_CLASS) ? 'dark' : 'light'),
  };