import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api, setToken } from '../../services/api';
import './AuthPage.css';

declare global {
  interface Window {
    google: any;
  }
}

export function AuthPage({ loadDataFromAPI }: { loadDataFromAPI: () => void }) {
  const { setUser, setUserRole, setActivePage, clearUserData } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Focus states
  const [fullNameActive, setFullNameActive] = useState(false);
  const [companyNameActive, setCompanyNameActive] = useState(false);
  const [phoneActive, setPhoneActive] = useState(false);
  const [passwordActive, setPasswordActive] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Toggle mode with animation
  const toggleAuth = (newMode: 'signin' | 'signup') => {
    if (isAnimating || mode === newMode) return;
    setIsAnimating(true);
    setTimeout(() => {
      setMode(newMode);
      setAuthError('');
      setIsAnimating(false);
    }, 400);
  };

  // Google OAuth logic
  const handleGoogleResponse = async (response: any) => {
    if (!response?.credential) {
      setAuthError('Google authentication failed');
      return;
    }
    setGoogleLoading(true);
    setAuthError('');
    try {
      const res = await api.googleAuth(response.credential);
      clearUserData();
      setToken(res.token);
      setUser(res.phone || res.email || null);
      setUserRole(res.role);
      setActivePage(res.role === 'operator' ? 'logger' : 'fleet');
      loadDataFromAPI();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google authentication failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: handleGoogleResponse,
          auto_select: false,
        });
      }
    };
    document.head.appendChild(script);
  }, []);

  const handleGoogleSignIn = () => {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.prompt();
    } else {
      setAuthError('Google Sign-In is loading. Please try again.');
    }
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (mode === 'signup') {
        const res = await api.register(phone, password, 'owner', companyName);
        clearUserData();
        setToken(res.token);
        setUser(res.phone);
        setUserRole(res.role);
        setActivePage('fleet');
        loadDataFromAPI();
      } else {
        const res = await api.login(phone, password);
        clearUserData();
        setToken(res.token);
        setUser(res.phone);
        setUserRole(res.role);
        setActivePage(res.role === 'operator' ? 'logger' : 'fleet');
        loadDataFromAPI();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleTestLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.testLogin();
      clearUserData();
      setToken(res.token);
      setUser(res.phone);
      setUserRole(res.role);
      setActivePage(res.role === 'operator' ? 'logger' : 'fleet');
      loadDataFromAPI();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Test login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Helper style generator for input borders and focus rings
  const inputWrapperStyle = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    borderRadius: '11px',
    overflow: 'hidden',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
    border: active ? '1.5px solid #F97316' : '1.5px solid #E2E8F0',
    background: active ? '#FFFAF7' : '#F7F9FC',
    boxShadow: active ? '0 0 0 3px rgba(249,115,22,0.13)' : 'none',
  });

  const submitBtnStyle = {
    background: authLoading
      ? 'linear-gradient(135deg, #FDBA74, #FB923C)'
      : 'linear-gradient(135deg, #F97316 0%, #C2410C 100%)',
    cursor: authLoading ? 'not-allowed' : 'pointer',
  };

  return (
    <div className="auth-container">
      {/* NAV */}
      <nav className="auth-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div className="nav-logo-box">
            <svg fill="none" height="15" viewBox="0 0 16 16" width="15">
              <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" fill="white" />
            </svg>
          </div>
          <span className="nav-logo-text">Suprwise</span>
        </div>
        <div className="nav-links-container">
          <a href="#" className="nav-link">Features</a>
          <a href="#" className="nav-link">Solutions</a>
          <a href="#" className="nav-link">Pricing</a>
        </div>
        <button 
          className="nav-btn"
          onClick={() => toggleAuth(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Create Account' : 'Sign In'}
        </button>
      </nav>

      {/* MAIN */}
      <main className="auth-main">
        <div className="auth-card">
          {/* LEFT: Form side */}
          <div className="auth-form-side">
            <div className={`transition-all duration-400 ${isAnimating ? 'opacity-0 translate-x-10' : 'opacity-100 translate-x-0'}`}>
              <div className="auth-form-header">
                <h1 className="auth-form-title">
                  {mode === 'signup' ? 'Create account' : 'Welcome back'}
                </h1>
                <p className="auth-form-desc">
                  {mode === 'signup' ? 'Join the most efficient SaaS ecosystem.' : 'Sign in to manage your workspace.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                {mode === 'signup' && (
                  <>
                    {/* Full Name */}
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <div style={inputWrapperStyle(fullNameActive)}>
                        <input 
                          onBlur={() => setFullNameActive(false)}
                          onFocus={() => setFullNameActive(true)}
                          onChange={e => setFullName(e.target.value)}
                          placeholder="John Doe"
                          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '0 14px', height: '50px', fontSize: '15px', color: '#0C1220', fontWeight: 500 }}
                          type="text"
                          value={fullName}
                          required
                        />
                      </div>
                    </div>

                    {/* Company Name */}
                    <div className="form-group">
                      <label className="form-label">Company Name</label>
                      <div style={inputWrapperStyle(companyNameActive)}>
                        <input 
                          onBlur={() => setCompanyNameActive(false)}
                          onFocus={() => setCompanyNameActive(true)}
                          onChange={e => setCompanyName(e.target.value)}
                          placeholder="My Fleet Co."
                          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '0 14px', height: '50px', fontSize: '15px', color: '#0C1220', fontWeight: 500 }}
                          type="text"
                          value={companyName}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Phone */}
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <div style={inputWrapperStyle(phoneActive)}>
                    <div className="phone-prefix-box">
                      <span style={{ fontSize: '17px', lineHeight: 1 }}>🇮🇳</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>+91</span>
                      <svg fill="none" height="10" viewBox="0 0 10 10" width="10">
                        <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="#94A3B8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                      </svg>
                    </div>
                    <input 
                      onBlur={() => setPhoneActive(false)}
                      onFocus={() => setPhoneActive(true)}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210"
                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '0 14px', height: '50px', fontSize: '15px', color: '#0C1220', fontWeight: 500 }}
                      type="tel"
                      value={phone}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                    {mode === 'signin' && (
                      <a href="#" className="forgot-password-link">Forgot password?</a>
                    )}
                  </div>
                  <div style={inputWrapperStyle(passwordActive)}>
                    <input 
                      onBlur={() => setPasswordActive(false)}
                      onFocus={() => setPasswordActive(true)}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '0 14px', height: '50px', fontSize: '15px', color: '#0C1220', fontWeight: 500 }}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      required
                    />
                    <button 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="eye-toggle-btn"
                      type="button"
                    >
                      {showPassword ? (
                        <svg fill="none" height="17" viewBox="0 0 24 24" width="17">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      ) : (
                        <svg fill="none" height="17" viewBox="0 0 24 24" width="17">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {authError && <div style={{ color: '#E11D48', fontSize: '14px', fontWeight: 500, marginBottom: '20px', textAlign: 'left' }}>{authError}</div>}

                {/* Submit */}
                <button 
                  style={submitBtnStyle}
                  className="submit-btn"
                  type="submit"
                  disabled={authLoading}
                >
                  {mode === 'signup' 
                    ? (authLoading ? 'Creating...' : 'Create Account') 
                    : (authLoading ? 'Signing in...' : 'Sign in')
                  }
                </button>

                {/* Divider */}
                <div className="form-divider">
                  <div className="divider-line" />
                  <span className="divider-text">OR CONTINUE WITH</span>
                  <div className="divider-line" />
                </div>

                {/* Google */}
                <button 
                  className="google-btn"
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                >
                  <svg height="19" viewBox="0 0 24 24" width="19">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  {mode === 'signup' 
                    ? (googleLoading ? 'Connecting...' : 'Sign up with Google')
                    : (googleLoading ? 'Connecting...' : 'Sign in with Google')
                  }
                </button>

                <p className="bottom-prompt-text">
                  {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
                  <button 
                    className="bottom-prompt-btn"
                    onClick={() => toggleAuth(mode === 'signin' ? 'signup' : 'signin')}
                    type="button"
                  >
                    {mode === 'signup' ? 'Sign In' : 'Create an account'}
                  </button>
                </p>

                {import.meta.env.DEV && (
                  <button 
                    className="w-full mt-4 text-xs font-mono text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={handleTestLogin}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                    type="button"
                  >
                    🧪 Test Login (9010719021)
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* RIGHT: Brand panel */}
          <div className="brand-side">
            {/* Decorative glows */}
            <div className="brand-glow-top" />
            <div className="brand-glow-bottom" />
            
            {/* Dot grid */}
            <div className="brand-dots" />
            
            {/* Subtle top border accent */}
            <div className="brand-top-accent" />
            
            {/* Top: logo + headline */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="brand-logo-row">
                <div className="brand-logo-box">
                  <svg fill="none" height="12" viewBox="0 0 16 16" width="12">
                    <path d="M8 1.5L13.5 4.75V11.25L8 14.5L2.5 11.25V4.75L8 1.5Z" fill="white" />
                  </svg>
                </div>
                <span className="brand-logo-text">Suprwise</span>
              </div>
              <h2 className="brand-heading">
                {mode === 'signup' 
                  ? 'The first platform built for cranes, excavators, and construction fleets.'
                  : 'Welcome back to Suprwise'
                }
              </h2>
              <p className="brand-subtext">
                {mode === 'signup'
                  ? 'Join 10,000+ construction leads optimizing their heavy machinery operations.'
                  : 'Ready to pick up where you left off? Your workspace is waiting.'
                }
              </p>
            </div>

            {/* Bottom: stats + testimonial */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Stats row */}
              <div className="brand-stats-row">
                <div className="brand-stat-card">
                  <div className="brand-stat-value">10K+</div>
                  <div className="brand-stat-label">Teams</div>
                </div>
                <div className="brand-stat-card">
                  <div className="brand-stat-value">99.9%</div>
                  <div className="brand-stat-label">Uptime</div>
                </div>
                <div className="brand-stat-card">
                  <div className="brand-stat-value">4.9★</div>
                  <div className="brand-stat-label">Rating</div>
                </div>
              </div>

              {/* Testimonial */}
              <div className="brand-testimonial-card">
                <div className="brand-stars">
                  {[1, 2, 3, 4, 5].map(star => (
                    <svg key={star} fill="#F97316" height="13" viewBox="0 0 20 20" width="13">
                      <path d="M10 1l2.39 7.26H20l-6.18 4.5 2.39 7.24L10 15.5l-6.21 4.5 2.39-7.24L0 8.26h7.61z" />
                    </svg>
                  ))}
                </div>
                <p className="brand-testimonial-text">
                  "The fastest onboarding experience I've ever had. Truly professional."
                </p>
                <div className="brand-author-row">
                  <div className="brand-avatar">
                    <span className="brand-avatar-text">S</span>
                  </div>
                  <div>
                    <div className="brand-author-name">Sarah J.</div>
                    <div className="brand-author-title">TechOps Director</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="auth-footer">
        <span className="auth-footer-brand">Suprwise</span>
        <div className="auth-footer-links">
          <a href="#" className="auth-footer-link">Privacy Policy</a>
          <a href="#" className="auth-footer-link">Terms of Service</a>
          <a href="#" className="auth-footer-link">Help Center</a>
        </div>
        <span className="auth-footer-copyright">
          © 2024 Suprwise Inc. All rights reserved.
        </span>
      </footer>
    </div>
  );
}
