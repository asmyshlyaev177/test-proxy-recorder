'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { API_BASE, setToken } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('Password123');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError('Invalid credentials');
        return;
      }
      const { token } = (await res.json()) as { token: string };
      // Stores the token in localStorage (one mechanism); the response also set
      // an httpOnly `session` cookie (the other). Playwright's storageState
      // captures both so the authenticated specs start already logged in.
      setToken(token);
      router.push('/dashboard');
    } catch {
      setError('Network error');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="container">
      <h1>Sign in</h1>
      <form className="card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="password"
          />
        </div>
        <button
          className="btn-primary btn-block"
          type="submit"
          disabled={pending}
          data-testid="signinButton"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        {error && (
          <p className="error" data-testid="login-error">
            {error}
          </p>
        )}
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Demo credentials are prefilled.
        </p>
      </form>
    </div>
  );
}
