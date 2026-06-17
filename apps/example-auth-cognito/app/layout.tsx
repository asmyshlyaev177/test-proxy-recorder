import type { Metadata } from 'next';
import 'example-auth-shared/globals.css';

export const metadata: Metadata = {
  title: 'Auth example (Cognito)',
  description: 'AWS Cognito authenticated Next.js example for test-proxy-recorder',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
