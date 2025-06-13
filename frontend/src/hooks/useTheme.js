import { useState, useEffect, useCallback } from 'react';

/**
 * Constants for theme management
 */
const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  STORAGE_KEY: 'isDark'
};

/**
 * Custom hook for managing light/dark theme
 * Handles localStorage securely and optimizes performance
 * @returns {Object} Theme management functions and state
 */
export function useTheme() {
  /**
   * Utility function to safely read from localStorage
   * @returns {boolean} Initial theme state
   */
  const getInitialTheme = useCallback(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }

    try {
      const saved = localStorage.getItem(THEME.STORAGE_KEY);
      if (saved !== null) {
        return JSON.parse(saved);
      }
      
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch (error) {
      console.warn('Error reading theme preference:', error);
      return false;
    }
  }, []);

  const [isDark, setIsDark] = useState(getInitialTheme);

  /**
   * Applies theme to DOM
   * @param {boolean} darkMode - Whether dark mode is enabled
   */
  const applyTheme = useCallback((darkMode) => {
    if (typeof document === 'undefined') return;

    try {
      const theme = darkMode ? THEME.DARK : THEME.LIGHT;
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', darkMode);
    } catch (error) {
      console.warn('Error applying theme:', error);
    }
  }, []);

  /**
   * Saves theme preference to localStorage
   * @param {boolean} darkMode - Theme preference to save
   */
  const saveThemePreference = useCallback((darkMode) => {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(THEME.STORAGE_KEY, JSON.stringify(darkMode));
    } catch (error) {
      console.warn('Error saving theme preference:', error);
    }
  }, []);

  /**
   * Toggles between light and dark theme
   */
  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const newTheme = !prev;
      saveThemePreference(newTheme);
      applyTheme(newTheme);
      return newTheme;
    });
  }, [saveThemePreference, applyTheme]);

  /**
   * Sets a specific theme
   * @param {boolean} darkMode - Whether to enable dark mode
   */
  const setTheme = useCallback((darkMode) => {
    if (typeof darkMode !== 'boolean') {
      console.warn('Invalid theme value provided');
      return;
    }
    setIsDark(darkMode);
    saveThemePreference(darkMode);
    applyTheme(darkMode);
  }, [saveThemePreference, applyTheme]);

  // Apply theme on mount and changes
  useEffect(() => {
    applyTheme(isDark);
  }, [isDark, applyTheme]);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      try {
        const savedPreference = localStorage.getItem(THEME.STORAGE_KEY);
        if (savedPreference === null) {
          setTheme(e.matches);
        }
      } catch (error) {
        console.warn('Error handling system theme change:', error);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [setTheme]);

  return {
    isDark,
    toggleTheme,
    setTheme,
    isLight: !isDark
  };
} 