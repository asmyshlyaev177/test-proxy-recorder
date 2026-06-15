import { parseCliArgs } from './cli.js';
import { initCommand } from './init.js';
import { ProxyServer } from './ProxyServer.js';

// `test-proxy-recorder init [...]` scaffolds a config file and exits; every
// other invocation starts the proxy as before.
if (process.argv[2] === 'init') {
  initCommand(process.argv.slice(3));
  process.exit(0);
}

const { target, port, recordingsDir, timeout, redaction, websocket } =
  await parseCliArgs();

const proxy = new ProxyServer(
  target,
  recordingsDir,
  timeout,
  redaction,
  websocket,
);
await proxy.init();
proxy.listen(port);

console.log(`Recordings will be saved to: ${recordingsDir}`);
