import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { secretQueryOptions } from '~/queries';

export const Route = createFileRoute('/secret')({
  component: SecretPage,
});

function SecretPage() {
  // No loader prefetch — this query runs on the client (on mount), so the browser
  // request carrying the Authorization header is recorded via HAR and must be
  // redacted (see e2e/assert-redactions.mjs).
  const { data, status } = useQuery(secretQueryOptions);
  const label = status === 'pending' ? 'loading' : status === 'error' ? 'error' : 'loaded';

  return (
    <div className="container">
      <h1>Secret</h1>
      <p data-testid="secret-status">{label}</p>
      {data && <p data-testid="secret-message">{data.message}</p>}
    </div>
  );
}
