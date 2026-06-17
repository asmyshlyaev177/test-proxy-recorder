import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The shared UI (TodoApp) ships as TypeScript source from a workspace package,
  // so Next must transpile it.
  transpilePackages: ['example-auth-shared'],
};

export default nextConfig;
