// Every user-facing string on the marketing homepage (src/pages/index.astro),
// in markup order. The page holds the structure, the URLs, the install command
// and the comparison data; this file holds the words, so a translation is a
// copy of this file and nothing else.
//
// Sentences that wrap an inline <code> or <a> in the markup are split into
// adjacent keys rather than carrying a tag in the value — the tag stays in
// index.astro and the fragments sit either side of it. Those keys carry a
// JSDoc line showing how the sentence reassembles.

import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'Record and replay API calls in Playwright, including SSR',
    description:
      'Record real API responses during a Playwright run and replay them on CI. Covers Next.js and TanStack Start server-side fetches, browser calls, WebSockets.',
    ogImageAlt:
      'test-proxy-recorder — record once, replay forever. Diagram of record and replay modes.',
  },

  chrome: {
    skipToContent: 'Skip to content',
    navQuickStart: 'Quick start',
    navDocs: 'Docs',
    updated: 'Updated',
    licensed: 'MIT licensed.',
    languageLabel: 'Language',
    copied: 'Copied',
  },

  hero: {
    title: 'Record and replay API calls in Playwright tests, including server-side requests',
    headlineTop: 'Record once.',
    headlineBottom: 'Replay forever.',
    sub: 'Records the API responses your app gets during a local Playwright run, WebSockets included, then replays them on CI with your backend off.',
    copyLabel: 'Copy',
    starCta: 'Star on GitHub',
    fine: 'MIT · TypeScript · Node ≥ 20 · Next.js & TanStack Start SSR, SPAs, Chrome extensions, WebSockets',
    scenePause: 'Pause',
    scenePlay: 'Play',
  },

  demo: {
    heading: 'See it record, then replay',
    sub: 'One Playwright run records real responses to disk; flip to replay and the same suite passes with the backend off.',
    videoLabel:
      'Screen recording: recording real API responses with test-proxy-recorder, then replaying them with the backend turned off.',
  },

  mechanisms: {
    heading: 'Two ways to record',
    sub: "Requests start in two places, so there are two ways to record them, and the proxy process runs in both. Anything sent to the proxy (server-side fetches, browser calls through an API base URL shared with the server, WebSockets) is replayed from the test's .mock.json. Browser calls to other hosts that match your fixture's url pattern are replayed from the test's .har.",
    proxy: {
      title: 'Proxy',
      flow: 'Next.js / TanStack Start SSR → proxy → real API',
      body: 'Sits between your server and the API. Records server-side requests: Server Component and SSR fetches, route handlers, anything your backend-for-frontend calls.',
      when: 'For full-stack apps where the server calls the API.',
      parallel: "Each test's server-side requests carry that test's id, so tests running in parallel never share a recording.",
      guideNextjs: 'Next.js guide\u00a0→',
      guideTanstack: 'TanStack Start guide\u00a0→',
      exampleNextjs: 'View Next.js example\u00a0→',
      exampleTanstack: 'View TanStack Start example\u00a0→',
    },
    har: {
      title: 'HAR',
      flow: 'browser → HAR intercept → real API',
      bodyStart: 'Intercepts in the browser itself and saves an HTTP Archive (HAR) file. Records client-side',
      bodyEnd: 'calls, Chrome extension API traffic, analytics and third-party APIs, whichever match the url pattern in your fixture.',
      when: 'For SPAs, extensions, and browser-only apps.',
      proxyNote:
        'Over plain routeFromHAR it adds one HAR per test and redacts auth headers.',
      guidePlaywright: 'Playwright guide\u00a0→',
      exampleExtension: 'View Chrome extension example\u00a0→',
      exampleVite: 'View Vite + WebSocket example\u00a0→',
    },
  },

  compare: {
    heading: 'Where it fits',
    sub: 'The mocking tools are good at different jobs. The combination below — recording real traffic across SSR, browser, and WebSockets, with no hand-written mocks — is the gap the others leave open.',
    tableCaption:
      'Feature comparison of test-proxy-recorder against Playwright routeFromHAR, MSW, Polly.js, playwright-network-cache, and Mocky Balboa.',
    featureLabel: 'Feature',
    features: [
      'Record real traffic',
      'Server-side (SSR)',
      'Browser-side',
      'WebSocket',
      'Playwright-native',
      'Maintained',
    ],
    markText: { y: 'Yes', n: 'No', p: 'Partial' },
    footStart:
      'Polly.js records inside the process it runs in, so for server-side requests it has to run inside your app server. MSW and Mocky Balboa mock server-side requests too, but you write the responses yourself. The full comparison, with sources and when to pick another tool, is in the',
    footLinkLabel: 'docs',
    footEnd: '.',
    tradeoff:
      "The trade-off is a more involved first setup than the browser-only tools: a proxy process runs beside your tests, and for server-side requests your app's API base URL points at it during test runs.",
  },

  auth: {
    heading: 'Works with your real auth provider',
    sub: "Log in through Cognito, Auth0, Clerk, or WorkOS — for real, on every run. Only your app's API is recorded; auth stays live, your data goes offline.",
    links: {
      cognito: 'AWS Cognito example\u00a0→',
      tanstack: 'Cognito on TanStack Start\u00a0→',
      mock: 'Mock auth (no cloud account)\u00a0→',
    },
  },

  recordingSample: {
    heading: 'What a recording looks like',
    perTest: {
      term: 'One file per test',
      start: 'Each test writes its own file, named after the test, so',
      end: 're-records just that one. The proxy records one test at a time, so record with one worker; replay runs in parallel.',
    },
    testId: {
      term: "The test's id",
      start: 'Playwright sends',
      mid: 'with every request a test makes, and',
      end: "copies it onto your server's own fetches. The proxy reads it to answer each test from that test's own file, even when tests replay in parallel.",
    },
    secrets: {
      term: 'Secrets',
      body: 'Authorization, Cookie and Set-Cookie headers become [REDACTED] in .mock.json files before they are written, and in .har files when the run ends. Secrets inside response bodies need patterns of your own.',
      link: 'Secret redaction\u00a0→',
    },
    caption:
      'Part of a real recording, 2.6 KB in full: the POST from one test, with its Authorization header redacted. The whole file also holds the GET that followed, every header, and a timestamp for each request.',
  },

  replayQuestions: {
    heading: 'Questions about replay',
    matching: {
      term: 'How are requests matched?',
      body: "The proxy matches a server-side call on its method, path and exact query string, not its body, and serves repeated calls in the order they were recorded. Browser calls follow Playwright's HAR rules, which also compare POST bodies. A query string that changes every run, such as a timestamp, never matches, and no option ignores a parameter, so keep such values fixed during tests.",
      link: 'How replay matches requests\u00a0→',
    },
    misses: {
      term: 'What if a recording is missing?',
      start:
        'The proxy answers 404 and names the request and the test. A call made more times than it was recorded gets the last response again, with a warning in the proxy log. In the browser, Playwright aborts a call that matches the',
      mid: 'pattern your fixture passes to',
      end: 'but is not in the HAR; other calls reach the network.',
    },
    liveApi: {
      term: 'When does replay reach the real API?',
      start:
        'Replay reaches the real API only after the proxy leaves replay mode, and the proxy keeps one mode for all running tests. It leaves replay mode 120 seconds after the last test started, or when a per-test hook calls',
      end: '. With no backend running in CI, such a call fails instead of passing.',
      link: 'Session timeout and teardown\u00a0→',
    },
    drift: {
      term: 'What happens when the API changes?',
      body: 'With a typed API client, updating the client for a changed field makes the replayed tests that use it fail, because the recordings still hold the old field. That points you at the change, and recording again fixes the tests with less work than editing hand-written mocks.',
    },
    overrides: {
      term: 'How do I test errors and edge cases?',
      start: 'In the browser, a',
      mid: 'registered after',
      end: 'overrides the recording. Server-side responses are edited in the .mock.json file.',
      link: 'Forcing a response\u00a0→',
    },
  },

  quickStart: {
    heading: 'Quick start',
    subStart:
      'Scaffold everything with one command, point your API at the proxy, then record and commit. Browser-only app?',
    subEnd: 'skips the SSR step for you.',
    tabs: {
      agent: 'With your AI agent',
      manual: 'By hand',
    },
    ai: {
      noteStart:
        "Paste this into Claude Code, Cursor or another coding agent. It first runs @tanstack/intent, which adds guidance to your agent's config file, such as CLAUDE.md, so the agent loads this library's setup skills. Then it installs the package, finds your backend URL in the app's config, runs",
      noteEnd: 'and finishes the wiring from its output.',
      copyLabel: 'Copy prompt',
    },
    changes: {
      label: 'What changes in your repo',
      tests:
        'In your test suite: a Playwright fixture, the proxy process (it runs only during tests), and recordings committed to git.',
      appStart:
        'In your app, only for server-side requests: point the API base URL at the proxy during test runs, and call',
      appEnd:
        "once, in app/layout.tsx on Next.js or src/router.tsx on TanStack Start. It copies the test's id onto each server-side fetch and does nothing in production unless TEST_PROXY_RECORDER_ENABLED is set.",
      agent:
        "With the agent prompt: @tanstack/intent adds guidance on loading this library's skills to your agent's config file, such as CLAUDE.md.",
      deployed:
        'Testing a deployed environment? HAR records its browser calls with no change to the app, but the pages themselves still load from that server. To replay server-side calls as well, run the app in CI next to the proxy.',
    },
    steps: {
      install: {
        title: 'Install & scaffold',
        noteStart: 'writes the proxy config, a Playwright fixture, a global teardown,',
        noteEnd:
          'scripts, and (on Next.js) wires SSR fetch tagging into your root layout — non-destructively.',
      },
      apiEnv: {
        title: 'Point server-side API calls at the proxy',
        noteStart: 'The one thing',
        noteEnd:
          "can't guess: which env var holds your API base URL. Point it at the proxy when the recorder is enabled, at the real backend otherwise — the proxy never runs in production.",
        ssrStart: 'On Next.js,',
        ssrAfterInit: 'also adds',
        ssrAfterFn: 'to your root layout to tag server-side',
        ssrEnd: 'calls — a no-op in production.',
        browserOnly:
          "Browser-only app? Skip this step unless the app opens WebSockets, which record only when they connect to the proxy's address.",
      },
      record: {
        title: 'Record, commit, replay',
        noteStart: 'Set',
        noteMid: ', run once against the real API, then flip to',
        noteEnd:
          "and commit. Recordings live in git — that's what makes CI deterministic. Don't gitignore them.",
      },
    },
    guideLink: 'Full setup guide\u00a0→',
  },

  cta: {
    heading: 'Stop hand‑writing mocks',
    sub: 'Your API already gives the right answers. Record them.',
    copyLabel: 'Copy',
    starCta: 'Star on GitHub',
    fineStart:
      "If it saved you an afternoon, a star takes one second — it's how the next person finds it, and it tells a solo maintainer to keep building. Hit a snag or have an idea?",
    issueLabel: 'Open an issue',
    fineBetween: 'or',
    discordLabel: 'join Discord',
    fineEnd: '.',
  },
};
