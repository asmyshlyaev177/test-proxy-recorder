import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { cognitoSignIn, setToken } from '~/lib/auth';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
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
      await navigate({ to: '/dashboard' });
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
        <div className="form-row">
          <input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            data-testid="email"
          />
        </div>
        <div className="form-row">
          <input
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            data-testid="password"
          />
        </div>
        <button
          className="btn-primary"
          type="submit"
          disabled={pending}
          data-testid="signinButton"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        {error && (
          <p className="empty" data-testid="login-error">
            {error}
          </p>
        )}
        <p className="empty">Use your Cognito test user (see README).</p>
      </form>
    </div>
  );
}
