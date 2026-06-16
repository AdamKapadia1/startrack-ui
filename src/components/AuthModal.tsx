import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface Props {
  open:    boolean;
  onClose: () => void;
}

type Tab = 'signin' | 'signup';

function Spinner() {
  return (
    <svg
      width="14" height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ animation: 'auth-spin 0.7s linear infinite', display: 'block' }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );
}

export function AuthModal({ open, onClose }: Props) {
  const { signIn, signUp, resetPassword } = useAuth();

  const [tab,          setTab]          = useState<Tab>('signin');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [confirmPw,    setConfirmPw]    = useState('');
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [resetSent,    setResetSent]    = useState(false);

  if (!open) return null;

  function reset() {
    setEmail(''); setPassword(''); setConfirmPw('');
    setError(''); setSuccessMsg(''); setResetSent(false); setBusy(false);
  }

  function switchTab(t: Tab) { reset(); setTab(t); }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setBusy(true);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) {
      if (err.message.toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email address before signing in.');
      } else {
        setError('Invalid email or password.');
      }
    } else {
      reset();
      onClose();
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error: err } = await signUp(email, password);
    setBusy(false);
    if (err) {
      if (err.message.toLowerCase().includes('already registered') || err.message.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists. Try signing in.');
      } else if (err.message.toLowerCase().includes('password')) {
        setError('Password is too weak. Use at least 8 characters.');
      } else {
        setError(err.message);
      }
    } else {
      setSuccessMsg('Account created! Check your email to confirm your address, then sign in.');
    }
  }

  async function handleForgotPassword() {
    if (!email) { setError('Enter your email address above, then click Forgot password.'); return; }
    setError(''); setBusy(true);
    const { error: err } = await resetPassword(email);
    setBusy(false);
    if (err) { setError(err.message); } else { setResetSent(true); }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Account">

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'signin' ? ' auth-tab--active' : ''}`}
            onClick={() => switchTab('signin')}
          >
            Sign in
          </button>
          <button
            className={`auth-tab${tab === 'signup' ? ' auth-tab--active' : ''}`}
            onClick={() => switchTab('signup')}
          >
            Create account
          </button>
        </div>

        {/* Sign in */}
        {tab === 'signin' && (
          <form className="auth-form" onSubmit={handleSignIn}>
            <label className="auth-label">Email
              <input
                className="auth-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>
            <label className="auth-label">Password
              <input
                className="auth-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </label>

            {error     && <p className="auth-error">{error}</p>}
            {resetSent && <p className="auth-success">Password reset email sent — check your inbox.</p>}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? <Spinner /> : 'Sign in'}
            </button>

            <button
              type="button"
              className="auth-link"
              onClick={handleForgotPassword}
              disabled={busy}
            >
              Forgot password?
            </button>
          </form>
        )}

        {/* Sign up */}
        {tab === 'signup' && (
          <form className="auth-form" onSubmit={handleSignUp}>
            {successMsg ? (
              <div className="auth-success-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00ff88" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p>{successMsg}</p>
                <button type="button" className="auth-submit" style={{ marginTop: 12 }} onClick={() => switchTab('signin')}>
                  Go to sign in
                </button>
              </div>
            ) : (
              <>
                <label className="auth-label">Email
                  <input
                    className="auth-input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </label>
                <label className="auth-label">Password
                  <input
                    className="auth-input"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="Min 8 characters"
                    minLength={8}
                  />
                </label>
                <label className="auth-label">Confirm password
                  <input
                    className="auth-input"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </label>

                {error && <p className="auth-error">{error}</p>}

                <button className="auth-submit" type="submit" disabled={busy}>
                  {busy ? <Spinner /> : 'Create account'}
                </button>
              </>
            )}
          </form>
        )}

        {/* Guest mode link */}
        <div className="auth-guest">
          <button type="button" className="auth-guest-btn" onClick={onClose}>
            Continue without an account
          </button>
        </div>

      </div>
    </div>
  );
}
