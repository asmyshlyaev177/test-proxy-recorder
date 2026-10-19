import net from 'node:net';

function listenOnFreePort(): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// The OS hands out unused ports, so a run never collides with another project's
// proxy or backend. All stay bound until each is read, so no two come back equal.
export async function getFreePorts(count: number): Promise<number[]> {
  const servers: net.Server[] = [];
  for (let i = 0; i < count; i += 1) servers.push(await listenOnFreePort());
  const ports = servers.map((s) => (s.address() as net.AddressInfo).port);
  await Promise.all(
    servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
  return ports;
}
