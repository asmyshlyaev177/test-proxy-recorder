import type { Metadata } from 'next';
import 'example-auth-shared/globals.css';

export const metadata: Metadata = {
  title: 'Auth example (mock provider)',
  description: 'Authenticated Next.js example for test-proxy-recorder',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
