import type { Metadata } from 'next';
import { registerProxyFetch } from 'test-proxy-recorder/nextjs';
import './globals.css';

// Tag every server-side fetch with the current test's recording id so the proxy
// can tell concurrent replay sessions apart. Must run here (root layout), not in
// instrumentation.ts — see the note in the README and the function's docs.
// No-op in production unless TEST_PROXY_RECORDER_ENABLED is set.
registerProxyFetch();

export const metadata: Metadata = {
  title: 'Edge Todo App',
  description: 'Example Next.js edge-runtime app for proxy recorder testing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
