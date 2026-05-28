# test-proxy-recorder — Skill Spec

`test-proxy-recorder` runs an HTTP proxy that records real API responses during test runs and replays them on CI, eliminating the need for manual mocks or a live backend. It supports two mechanisms: a Node.js proxy for server-side (SSR) requests saved as `.mock.json`, and Playwright's HAR mechanism for browser-side `fetch` calls saved as `.har`.

## Domains

| Domain | Description | Skills |
| --- | --- | --- |
| wiring up the proxy | Everything needed to get recording/replay working: proxy process, scripts, playwright.config.ts, fixtures, record→replay cycle | proxy-setup |
| forwarding session identity through SSR | Getting x-test-rcrd-id through Next.js middleware and every SSR fetch path so the proxy correlates server-side requests to the right test | nextjs-ssr |

## Skill Inventory

| Skill | Type | Domain | What it covers | Failure modes |
| --- | --- | --- | --- | --- |
| proxy-setup | core | wiring up the proxy | CLI, package.json scripts, playwright.config.ts webServer, fixtures, HAR url pattern, record/replay lifecycle, parallel execution | 6 |
| nextjs-ssr | framework | forwarding session identity through SSR | middleware.ts vs proxy.ts, setNextProxyHeaders, createHeadersWithRecordingId, React cache() pattern, axios interceptor | 5 |

## Failure Mode Inventory

### proxy-setup (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | UI app still points to real backend in test mode | CRITICAL | README, maintainer interview | — |
| 2 | Wrong CLIENT_SIDE_URL pattern for HAR recording | CRITICAL | README, example-extension/fixtures.ts | — |
| 3 | Calling teardown() per-test in parallel mode | HIGH | README — Parallel Replay section | — |
| 4 | webServer URL set to proxy base instead of /__control | HIGH | README, example-extension/playwright.config.ts | — |
| 5 | Recording files added to .gitignore | HIGH | README | — |
| 6 | Using Next.js dev server for recording instead of build+start | MEDIUM | README, example-nextjs16/package.json | — |
| 7 | Running recording tests with multiple workers | MEDIUM | example-nextjs16/package.json | — |

### nextjs-ssr (5 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | Using middleware.ts in Next.js 16 instead of proxy.ts | HIGH | README — Next.js 16 section | — |
| 2 | Calling setNextProxyHeaders without injecting into individual fetches | HIGH | README, channels/web/app/api | — |
| 3 | Not guarding header forwarding in production | MEDIUM | src/nextjs/middleware.ts | — |
| 4 | Re-reading next/headers on every SSR fetch instead of caching | MEDIUM | channels/web/lib/recording-id.ts | — |
| 5 | Importing next/headers at module level in axios interceptor | MEDIUM | channels/web/core/api/axios.ts | — |

## Tensions

| Tension | Skills | Agent implication |
| --- | --- | --- |
| record simplicity vs. replay determinism | proxy-setup ↔ proxy-setup | Agents default dev server for recording; must use build+start |
| per-test cleanup vs. parallel safety | proxy-setup ↔ proxy-setup | Agents add teardown() to afterAll/afterEach; correct pattern omits it entirely |
| middleware simplicity vs. SSR header completeness | proxy-setup ↔ nextjs-ssr | Agents stop at middleware and miss per-fetch header injection |

## Cross-References

| From | To | Reason |
| --- | --- | --- |
| proxy-setup | nextjs-ssr | Full-stack setup requires SSR header forwarding — incomplete without it for Next.js apps |
| nextjs-ssr | proxy-setup | Next.js helpers are meaningless without proxy configured first |

## Subsystems & Reference Candidates

| Skill | Subsystems | Reference candidates |
| --- | --- | --- |
| proxy-setup | Browser-only/HAR-only, Full-stack (proxy + HAR) | — |
| nextjs-ssr | Next.js 13–15 (middleware.ts), Next.js 16 (proxy.ts) | — |

## Remaining Gaps

None — all gaps resolved through codebase reading and maintainer interview.

## Recommended Skill File Structure

- **Core skills:** `proxy-setup` — framework-agnostic proxy wiring, fixtures, record/replay lifecycle
- **Framework skills:** `nextjs-ssr` — Next.js header propagation through middleware and SSR fetches
- **Lifecycle skills:** none needed (record→replay cycle covered within proxy-setup)
- **Composition skills:** none needed at this time
- **Reference files:** none needed (API surface is small)

## Composition Opportunities

| Library | Integration points | Composition skill needed? |
| --- | --- | --- |
| @playwright/test | playwrightProxy.before(), page.routeFromHAR(), webServer config | No — covered within proxy-setup |
| concurrently | Service orchestration in package.json scripts | No — usage pattern covered within proxy-setup |
| next/server | Middleware, NextRequest/NextResponse, headers() | No — covered within nextjs-ssr |
| axios | SSR interceptor pattern for adding recording ID header | No — covered within nextjs-ssr |
