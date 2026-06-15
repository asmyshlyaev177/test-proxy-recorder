import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveResetPort, runReset } from './reset.js';

describe('resolveResetPort precedence', () => {
  it('prefers the CLI flag over env and config', () => {
    expect(
      resolveResetPort({ cliPort: '9001', envPort: '9002', configPort: 9003 }),
    ).toBe(9001);
  });

  it('uses the env var when no flag is given', () => {
    expect(resolveResetPort({ envPort: '9002', configPort: 9003 })).toBe(9002);
  });

  it('ignores an empty env var and falls through to config', () => {
    expect(resolveResetPort({ envPort: '', configPort: 9003 })).toBe(9003);
  });

  it('uses the config value when no flag or env is given', () => {
    expect(resolveResetPort({ configPort: 9003 })).toBe(9003);
  });

  it('falls back to the default port when nothing is set', () => {
    expect(resolveResetPort({})).toBe(8000);
  });

  it('rejects out-of-range and non-numeric ports', () => {
    expect(() => resolveResetPort({ cliPort: '80' })).toThrow(/between/);
    expect(() => resolveResetPort({ cliPort: '70000' })).toThrow(/between/);
    expect(() => resolveResetPort({ cliPort: 'abc' })).toThrow(/between/);
  });
});

describe('runReset', () => {
  let server: http.Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  /** Boot a stub control endpoint and return its port. */
  async function startStub(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  ): Promise<number> {
    server = http.createServer(handler);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    return (server!.address() as AddressInfo).port;
  }

  it('POSTs a transparent mode change to /__control', async () => {
    let received: { method?: string; url?: string; body: string } = {
      body: '',
    };
    const port = await startStub((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        received = {
          method: req.method,
          url: req.url,
          body: Buffer.concat(chunks).toString('utf8'),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, mode: 'transparent' }));
      });
    });

    const result = await runReset(port);

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('transparent');
    expect(received.method).toBe('POST');
    expect(received.url).toBe('/__control');
    expect(JSON.parse(received.body)).toEqual({ mode: 'transparent' });
  });

  it('reports a non-OK response as a failure', async () => {
    const port = await startStub((_req, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad' }));
    });

    const result = await runReset(port);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('400');
  });

  it('treats an unreachable proxy as a no-op success', async () => {
    // Bind to an ephemeral port, then close it so nothing is listening there.
    const port = await startStub((_req, res) => res.end());
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;

    const result = await runReset(port);

    expect(result.ok).toBe(true);
    expect(result.unreachable).toBe(true);
    expect(result.message).toContain('nothing to reset');
  });
});
