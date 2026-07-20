import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { ProtectedTodoApp } from '~/components/ProtectedTodoApp';
import { clearToken, getToken } from '~/lib/auth';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [token, setTok] = useState<string | null>(null);

  useEffect(() => {
    // The token is in localStorage (client-only), so read it after mount. No
    // token → bounce to the login form. This also means the SSR pass renders the
    // "loading" placeholder, matching the client's first render (no hydration
    // mismatch); the protected fetch happens on the client and is recorded via HAR.
    const t = getToken();
    if (!t) {
      void navigate({ to: '/login' });
      return;
    }
    setTok(t);
  }, [navigate]);

  if (!token) {
    return (
      <div className="container">
        <p className="empty" data-testid="dashboard-status">
          loading
        </p>
      </div>
    );
  }

  function signOut() {
    clearToken();
    void navigate({ to: '/login' });
  }

  return (
    <>
      <div className="container" style={{ paddingBottom: 0 }}>
        <p className="empty" data-testid="dashboard-status">
          Signed in —{' '}
          <button
            className="btn-ghost"
            onClick={signOut}
            data-testid="signout-btn"
          >
            Sign out
          </button>
        </p>
      </div>
      <ProtectedTodoApp token={token} />
    </>
  );
}
