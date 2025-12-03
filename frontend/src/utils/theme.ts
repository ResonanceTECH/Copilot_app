export type Theme = 'light' | 'dark' | 'system';

const applyLightTheme = () => {
  const root = document.documentElement;
  root.style.setProperty('--color-bg', '#ffffff');
  root.style.setProperty('--color-sidebar-bg', '#f9fafb');
  root.style.setProperty('--color-input-bg', '#ffffff');
  root.style.setProperty('--color-message-bg', '#f3f4f6');
  root.style.setProperty('--color-hover', 'rgba(0, 0, 0, 0.05)');
  root.style.setProperty('--color-text', '#111827');
  root.style.setProperty('--color-text-secondary', '#6b7280');
  root.style.setProperty('--color-text-placeholder', '#9ca3af');
  root.style.setProperty('--color-border', '#e5e7eb');
  root.style.setProperty('--color-border-hover', '#d1d5db');
};

const applyDarkTheme = () => {
  const root = document.documentElement;
  root.style.setProperty('--color-bg', '#111827');
  root.style.setProperty('--color-sidebar-bg', '#0f172a');
  root.style.setProperty('--color-input-bg', '#1f2937');
  root.style.setProperty('--color-message-bg', '#1f2937');
  root.style.setProperty('--color-hover', 'rgba(255, 255, 255, 0.05)');
  root.style.setProperty('--color-text', '#f9fafb');
  root.style.setProperty('--color-text-secondary', '#9ca3af');
  root.style.setProperty('--color-text-placeholder', '#6b7280');
  root.style.setProperty('--color-border', '#374151');
  root.style.setProperty('--color-border-hover', '#4b5563');
};

export const applyTheme = (theme: Theme) => {
  if (theme === 'light') {
    applyLightTheme();
  } else if (theme === 'dark') {
    applyDarkTheme();
  } else {
    // Системная тема - определяем по prefers-color-scheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyDarkTheme();
    } else {
      applyLightTheme();
    }
  }
  
  localStorage.setItem('theme', theme);
};

export const getTheme = (): Theme => {
  const savedTheme = localStorage.getItem('theme') as Theme | null;
  return savedTheme || 'system';
};

// Слушаем изменения системной темы
export const watchSystemTheme = (callback: () => void) => {
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', callback);
    return () => mediaQuery.removeEventListener('change', callback);
  }
  return () => {};
};

