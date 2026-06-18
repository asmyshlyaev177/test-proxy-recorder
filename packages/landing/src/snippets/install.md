```bash
npm install --save-dev test-proxy-recorder
# http://localhost:3002 is your API endpoint; 8100 is the proxy. Flags are optional.
npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings
```
