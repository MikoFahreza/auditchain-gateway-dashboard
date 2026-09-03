import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Icon from '../components/common/Icon';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      if (rememberMe) {
        localStorage.setItem('token', response.data.token);
        sessionStorage.removeItem('token');
      } else {
        sessionStorage.setItem('token', response.data.token);
        localStorage.removeItem('token');
      }
      if (onLogin) onLogin(true);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ac-login-page">
      {/* ===== HERO PANEL ===== */}
      <div className="ac-login-hero">
        {/* Decorative background */}
        <div className="ac-login-hero__bg">
          <svg width="100%" height="100%" viewBox="0 0 700 900" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: 12 }).map((_, r) =>
              Array.from({ length: 8 }).map((_, c) => (
                <circle key={`${r}-${c}`} cx={c * 100 + 30} cy={r * 80 + 30} r="1.5" fill="rgba(255,255,255,0.15)" />
              ))
            )}
            <line x1="120" y1="180" x2="280" y2="300" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <line x1="280" y1="300" x2="460" y2="220" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <line x1="460" y1="220" x2="580" y2="380" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            <line x1="120" y1="180" x2="460" y2="220" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <line x1="280" y1="300" x2="580" y2="380" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <line x1="200" y1="500" x2="400" y2="560" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
            <line x1="400" y1="560" x2="560" y2="480" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
            <circle cx="120" cy="180" r="10" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <circle cx="280" cy="300" r="14" fill="rgba(255,255,255,0.20)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
            <circle cx="460" cy="220" r="10" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            <circle cx="580" cy="380" r="8" fill="rgba(255,255,255,0.20)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
            <circle cx="200" cy="500" r="12" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
            <circle cx="400" cy="560" r="16" fill="rgba(255,255,255,0.20)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
            <circle cx="560" cy="480" r="9" fill="rgba(255,255,255,0.20)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
            {/* removed hash marks */}
            <circle cx="620" cy="100" r="180" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="40" />
            <circle cx="-30" cy="750" r="200" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="60" />
          </svg>
        </div>

        {/* Brand */}
        <div>
          <div className="ac-login-hero__brand">
            <img src="/logo/logo-with-background.png" alt="Auditchain Gateway Logo" style={{ height: 42, width: 'auto', display: 'block', flexShrink: 0, borderRadius: 8 }} />
            <div>
              <div className="ac-login-hero__brand-name">Auditchain Gateway</div>
              <div className="ac-login-hero__brand-sub">Secure Access Portal</div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div>
          <h1 className="ac-login-hero__title">Auditchain Gateway<br />Portal</h1>
          <p className="ac-login-hero__desc">
            Access the blockchain-backed control center for audit log monitoring,
            evidence integrity, and compliance visibility across every connected environment.
          </p>
        </div>

        {/* Info box */}
        <div className="ac-login-hero__infobox">
          <div className="ac-login-hero__infobox-icon">
            <Icon name="key" size={21} style={{ color: 'rgba(255,255,255,0.92)' }} />
          </div>
          <div>
            <div className="ac-login-hero__infobox-title">Protected Gateway Access</div>
            <div className="ac-login-hero__infobox-text">
              This portal is available only to approved auditors and administrators.
              Every session is monitored and recorded for security review.
            </div>
          </div>
        </div>
      </div>

      {/* ===== FORM PANEL ===== */}
      <div className="ac-login-form-panel">
        <div className="ac-login-card">
          <div className="ac-login-card__topbar">
            <Link
              to="/"
              className="ac-login-card-back-link"
              aria-label="Back to home page"
            >
              <span className="ac-login-card-back-link__icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </span>
              <span>Back home</span>
            </Link>
          </div>

          {/* Mobile brand header */}
          <div className="ac-login-mobile-brand">
            <img src="/logo/logo-with-background.png" alt="Auditchain Logo" style={{ height: 36, width: 'auto', display: 'block', flexShrink: 0, borderRadius: 6 }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0d1b2e', letterSpacing: '.02em' }}>Auditchain Gateway</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#0077ce', letterSpacing: '.1em', textTransform: 'uppercase' }}>Secure Access Portal</div>
            </div>
          </div>

          <div className="ac-login-card__heading">
            <h2 className="ac-login-card__title">Sign In</h2>
            <p className="ac-login-card__subtitle">Please authenticate to access the portal.</p>
          </div>

          {error && (
            <div className="ac-login__error">
              <Icon name="alert" size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span className="ac-login__error-text">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            {/* Username */}
            <div className="ac-field">
              <label className="ac-field__label" htmlFor="login-username">Username</label>
              <div className="ac-field__wrap">
                <span className="ac-field__icon"><Icon name="user" size={17} /></span>
                <input
                  id="login-username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className={`ac-field__input${error ? ' ac-field__input--error' : ''}`}
                />
              </div>
            </div>

            {/* Password */}
            <div className="ac-field">
              <label className="ac-field__label" htmlFor="login-password">Password</label>
              <div className="ac-field__wrap">
                <span className="ac-field__icon"><Icon name="lock" size={17} /></span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={`ac-field__input ac-field__input--pr${error ? ' ac-field__input--error' : ''}`}
                />
                <button type="button" className="ac-field__toggle" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} />
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="ac-login-remember">
              <input id="remember-me" type="checkbox" className="ac-login-remember__check" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
              <label htmlFor="remember-me" className="ac-login-remember__label">Remember me</label>
            </div>

            {/* Submit */}
            <button type="submit" className="ac-login__submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Icon name="spinner" size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Signing in...
                </>
              ) : (
                <>
                  <Icon name="shield" size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <hr className="ac-login__divider" />
          <div className="ac-login__security">
            <Icon name="warn" size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <p className="ac-login__security-text">
              This portal is restricted to authorized personnel only. All activities are monitored and recorded for security and compliance purposes.
            </p>
          </div>

          <div className="ac-login__footer">
            © 2026 Auditchain Gateway &nbsp;·&nbsp; Secure Log Management v2.4.1
          </div>
        </div>
      </div>
    </div>
  );
}

export { LoginPage };
export default LoginPage;
