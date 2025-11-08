import { parseCliArgs } from './cli.js';
import { ProxyServer } from './ProxyServer.js';

const { targets, port, recordingsDir } = parseCliArgs();

const proxy = new ProxyServer(targets, recordingsDir);
await proxy.init();
proxy.listen(port);

console.log(`Recordings will be saved to: ${recordingsDir}`);
