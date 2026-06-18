```bash
# 1. Set MODE = 'record' in your test file, run against the real API
npx playwright test --ui       # recordings written to e2e/recordings/

# 2. Flip MODE back to 'replay' and commit the recordings
git add e2e/recordings/
git commit -m "add e2e recordings"
```
