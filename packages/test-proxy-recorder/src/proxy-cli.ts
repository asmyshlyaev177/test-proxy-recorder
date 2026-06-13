import { parseCliArgs } from './cli.js';
import { ProxyServer } from './ProxyServer.js';

const { target, port, recordingsDir, timeout, redaction } = parseCliArgs();

const proxy = new ProxyServer(target, recordingsDir, timeout, redaction);
await proxy.init();
proxy.listen(port);

console.log(`Recordings will be saved to: ${recordingsDir}`);
