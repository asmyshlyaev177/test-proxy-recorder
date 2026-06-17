'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cognitoSignIn, setToken } from '../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      // Authenticates against real Cognito. The resulting access token is stored
      // in localStorage; the dashboard sends it as a Bearer header to the
      // (recorded) protected API, where the recorder redacts it.
      const token = await cognitoSignIn(email, password);
      setToken(token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="container">
      <h1>Sign in with Cognito</h1>
      <form className="card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
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
            autoComplete="current-password"
            required
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
          Use your Cognito test user (see README).
        </p>
      </form>
    </div>
  );
}
