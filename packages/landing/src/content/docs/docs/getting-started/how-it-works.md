---
title: How it works
description: test-proxy-recorder records traffic through two mechanisms — a proxy for server-side requests and HAR for browser-side requests. Use them together or independently.
---

test-proxy-recorder supports two recording mechanisms depending on where your requests originate. Both can be used together or independently.

| Mechanism | What it records | Use case |
| --------- | --------------- | -------- |
| **Proxy** (`.mock.json`) | Server-side requests (SSR fetches from Next.js etc.) | Full-stack apps where the server calls the API |
| **HAR** (`.har`) | Browser-side requests (browser `fetch`, extensions, SPAs) | SPAs, Chrome extensions, 3rd-party APIs |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

Each mode is set per test session. In **record** mode the proxy forwards to the real backend and saves responses; in **replay** mode it serves the saved responses from disk; in **transparent** mode it forwards without recording. See the [control endpoint](/docs/guides/control-endpoint/) for how modes are switched.
