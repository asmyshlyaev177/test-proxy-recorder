import type { Metadata } from 'next';
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';
import './globals.css';

// Tag every server-side fetch with the current test's recording-session id so the
// proxy can attribute SSR requests to the right test (and keep parallel replay
// correct). No middleware needed. No-op in production unless
// TEST_PROXY_RECORDER_ENABLED is set. Record against a production build
// (next build && next start), not next dev — see e2e/ssr.spec.ts.
registerProxyFetch();

export const metadata: Metadata = {
  title: 'Todo App',
  description: 'Example Next.js todo app for proxy recorder testing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
