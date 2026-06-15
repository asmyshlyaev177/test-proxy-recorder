import { playwrightProxy } from 'test-proxy-recorder';

// Reset the proxy to transparent after the whole run.
export default async function globalTeardown() {
  await playwrightProxy.teardown();
}
