```text
Set up test-proxy-recorder for end-to-end tests in this project, then follow the
instructions that `init` prints. Run these commands:

  npx @tanstack/intent@latest install
  npm install --save-dev test-proxy-recorder
  npx test-proxy-recorder init http://localhost:3002 --port 8100 --dir ./e2e/recordings

Then complete the app-specific steps init prints: point the app's API base URL at
the proxy in dev/test only, tag server-side fetches (Next.js), add a smoke test,
and verify record → replay.
```
