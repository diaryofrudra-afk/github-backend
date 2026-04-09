import { useState, useRef, useEffect } from 'react';
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
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [, setOtpExpiresAt] = useState<Date | null>(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const otpRequestRef = useRef(false);

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
      setUser(res.phone || res.email);
      setUserRole(res.role);
      setActivePage(res.role === 'operator' ? 'logger' : 'fleet');
      loadDataFromAPI();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google authentication failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          window.google.accounts.id.prompt();
        }
      });
    } else {
      setAuthError('Google Sign-In is loading. Please try again.');
    }
  };

  function startOtpTimer(minutes: number) {
    const end = new Date(Date.now() + minutes * 60 * 1000);
    setOtpExpiresAt(end);
    setOtpSecondsLeft(minutes * 60);
    const interval = setInterval(() => {
      const left = Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000));
      setOtpSecondsLeft(left);
      if (left <= 0) clearInterval(interval);
    }, 1000);
    return interval;
  }

  async function handleRequestOtp() {
    if (otpRequestRef.current || otpSecondsLeft > 0) return;
    otpRequestRef.current = true;
    setAuthError('');
    setAuthLoading(true);
    try {
      const purpose = mode === 'register' ? 'registration' : 'login';
      const resp = await api.sendSmsOtp(phone, purpose);
      setOtpRequested(true);
      const mins = resp.expires_in_minutes || 10;
      startOtpTimer(mins);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setAuthLoading(false);
      otpRequestRef.current = false;
    }
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setAuthError('');
    if (!otpRequested) {
      await handleRequestOtp();
      return;
    }
    setAuthLoading(true);
    try {
      if (mode === 'register') {
        const res = await api.registerWithOtp(phone, name, email, otp);
        clearUserData();
        setToken(res.token);
        setUser(res.phone);
        setUserRole(res.role);
        setActivePage('fleet');
        loadDataFromAPI();
      } else {
        const res = await api.verifyLoginOtp(phone, otp);
        clearUserData();
        setToken(res.token);
        setUser(res.phone);
        setUserRole(res.role);
        setActivePage(res.role === 'operator' ? 'logger' : 'fleet');
        loadDataFromAPI();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAuthLoading(false);
    }
  }

  function resetForm() {
    setAuthError('');
    setOtpRequested(false);
    setOtp('');
    setOtpExpiresAt(null);
    setOtpSecondsLeft(0);
    otpRequestRef.current = false;
  }

  function switchToLogin() { setMode('login'); resetForm(); }
  function switchToRegister() { setMode('register'); resetForm(); }

  return (
    <div className="auth-page">
      <div className={`auth-container ${mode === 'register' ? 'active' : ''}`} id="auth-container">
        {/* Sign Up Form */}
        <div className="form-container sign-up-form">
          <form onSubmit={handleSubmit}>
            <h1>Create Account</h1>

            {!otpRequested && (
              <>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" required />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" required />
              </>
            )}

            <div className="phone-input-wrapper">
              <span className="country-code">+91</span>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={e => {
                  if (e.key === 'Backspace' && phone.length === 0) e.preventDefault();
                }}
                placeholder="Phone Number"
                required
                disabled={otpRequested}
              />
            </div>

            {otpRequested && (
              <div className="otp-input-wrapper">
                <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter OTP" required maxLength={6} className="otp-input" autoFocus />
                {otpSecondsLeft > 0 && (
                  <div className="otp-timer">Expires in {Math.floor(otpSecondsLeft / 60)}:{String(otpSecondsLeft % 60).padStart(2, '0')}</div>
                )}
              </div>
            )}

            {authError && <div className="auth-error">{authError}</div>}

            <div className={`submit-wrapper ${phone.length === 10 ? 'visible' : ''}`}>
              <button type="submit" className="submit-btn" disabled={authLoading}>
                <svg className="submit-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {authLoading ? (otpRequested ? 'Verifying...' : 'Sending OTP...') : !otpRequested ? 'Request OTP' : 'Create Account'}
              </button>
            </div>

            <div className="divider"><span>or sign up with email</span></div>

            <button type="button" className="google-btn" onClick={handleGoogleSignIn} disabled={googleLoading}>
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {googleLoading ? 'Connecting...' : 'Sign up with Google'}
            </button>
          </form>
        </div>

        {/* Sign In Form */}
        <div className="form-container sign-in-form">
          <form onSubmit={handleSubmit}>
            <h1>Sign In</h1>

            <div className="phone-input-wrapper">
              <span className="country-code">+91</span>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={e => {
                  if (e.key === 'Backspace' && phone.length === 0) e.preventDefault();
                }}
                placeholder="Phone Number"
                required
                disabled={otpRequested}
              />
            </div>

            {otpRequested && (
              <div className="otp-input-wrapper">
                <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter OTP" required maxLength={6} className="otp-input" autoFocus />
                {otpSecondsLeft > 0 && (
                  <div className="otp-timer">Expires in {Math.floor(otpSecondsLeft / 60)}:{String(otpSecondsLeft % 60).padStart(2, '0')}</div>
                )}
              </div>
            )}

            {authError && <div className="auth-error">{authError}</div>}

            <div className={`submit-wrapper ${phone.length === 10 ? 'visible' : ''}`}>
              <button type="submit" className="submit-btn" disabled={authLoading}>
                <svg className="submit-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {authLoading ? (otpRequested ? 'Verifying...' : 'Sending OTP...') : !otpRequested ? 'Request OTP' : 'Sign In'}
              </button>
            </div>

            <div className="divider"><span>or sign in with email</span></div>

            <button type="button" className="google-btn" onClick={handleGoogleSignIn} disabled={googleLoading}>
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {googleLoading ? 'Connecting...' : 'Sign in with Google'}
            </button>
          </form>
        </div>

        {/* Toggle Panel */}
        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-panel toggle-left">
              <h1>Welcome To<br />Suprwise</h1>
              <p>Sign In to to see your Dashboard</p>
              <button className="hidden" id="login" onClick={switchToLogin}>Sign In</button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1>New to Suprwise ?</h1>
              <p>Register to track your fleet using our Ai Powered Fleet Managment App</p>
              <button className="hidden" id="register" onClick={switchToRegister}>Sign Up</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
