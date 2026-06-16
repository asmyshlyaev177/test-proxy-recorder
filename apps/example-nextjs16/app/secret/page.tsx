'use client';

import { useEffect, useState } from 'react';

// Same convention as TodoApp: in dev/test this points at the proxy so the
// browser request is recorded; in production it points at the real backend.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8100';

// In a real app this would come from auth/session. It's here so the recorded
// request carries an Authorization header (and the response a secret) that the
// recorder must redact before the .har is committed.
const SESSION_TOKEN = 'super-secret-har-jwt';

export default function SecretPage() {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/secret`, {
      headers: {
        authorization: `Bearer ${SESSION_TOKEN}`,
        'x-api-key': 'har-key-secret',
      },
    })
      .then((res) => res.json())
      .then((data: { message: string }) => {
        setMessage(data.message);
        setStatus('loaded');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="container">
      <h1>Secret</h1>
      <p data-testid="secret-status">{status}</p>
      {status === 'loaded' && <p data-testid="secret-message">{message}</p>}
    </div>
  );
}
