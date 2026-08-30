import React, { Suspense, lazy, useEffect, useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import { parseJwt } from './utils/formatters';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

const THEME_STORAGE_KEY = 'auditchain_appearance';
const THEME_OPTIONS = ['light', 'dark', 'system'];

const getStoredThemePreference = () => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return THEME_OPTIONS.includes(stored) ? stored : 'system';
};

const getSystemTheme = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!(localStorage.getItem('token') || sessionStorage.getItem('token'));
  });
  const [, setAuthVersion] = useState(0);
  const [themePreference, setThemePreference] = useState(getStoredThemePreference);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setIsAuthenticated(false);
    setAuthVersion(v => v + 1);
  };

  const handleAuthRefresh = () => {
    setAuthVersion(v => v + 1);
  };

  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const clientInfo = useMemo(() => {
    if (!isAuthenticated) return null;
    return token ? parseJwt(token) : null;
  }, [isAuthenticated, token]);

  const isAdmin = clientInfo?.role?.toLowerCase() === 'admin';
  const resolvedTheme = themePreference === 'system' ? systemTheme : themePreference;

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');

    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    document.documentElement.setAttribute('data-ac-theme', resolvedTheme);
    document.documentElement.setAttribute('data-ac-theme-preference', themePreference);
  }, [themePreference, resolvedTheme]);

  return (
    <Router>
      <Suspense fallback={<div className="ac-route-loading">Loading...</div>}>
        <Routes>
          <Route
            path="/"
            element={
              <LandingPage
                resolvedTheme={resolvedTheme}
                onThemeChange={setThemePreference}
              />
            }
          />
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <LoginPage onLogin={() => { setIsAuthenticated(true); handleAuthRefresh(); }} />
              ) : (
                <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <DashboardPage
                  onLogout={handleLogout}
                  onProfileUpdated={handleAuthRefresh}
                  themePreference={themePreference}
                  resolvedTheme={resolvedTheme}
                  onThemeChange={setThemePreference}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <DashboardPage
                  view="profile"
                  onLogout={handleLogout}
                  onProfileUpdated={handleAuthRefresh}
                  themePreference={themePreference}
                  resolvedTheme={resolvedTheme}
                  onThemeChange={setThemePreference}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/web-users"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <DashboardPage
                  view="web-users"
                  onLogout={handleLogout}
                  onProfileUpdated={handleAuthRefresh}
                  themePreference={themePreference}
                  resolvedTheme={resolvedTheme}
                  onThemeChange={setThemePreference}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <DashboardPage
                  view="audit-logs"
                  onLogout={handleLogout}
                  onProfileUpdated={handleAuthRefresh}
                  themePreference={themePreference}
                  resolvedTheme={resolvedTheme}
                  onThemeChange={setThemePreference}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <DashboardPage
                  view="reports"
                  onLogout={handleLogout}
                  onProfileUpdated={handleAuthRefresh}
                  themePreference={themePreference}
                  resolvedTheme={resolvedTheme}
                  onThemeChange={setThemePreference}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                {isAdmin ? (
                  <AdminPage
                    onLogout={handleLogout}
                    themePreference={themePreference}
                    resolvedTheme={resolvedTheme}
                    onThemeChange={setThemePreference}
                  />
                ) : (
                  <Navigate to="/dashboard" replace />
                )}
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
