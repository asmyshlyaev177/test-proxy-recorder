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
    title: 'VCR for Playwright — record & replay API responses | test-proxy-recorder',
    description:
      'VCR-style record & replay for Playwright. Capture real API responses once, replay them deterministically on CI — no backend, no hand-written mocks. SSR proxy + browser HAR, WebSockets. Free & MIT.',
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
  },

  hero: {
    eyebrow: 'VCR for Playwright',
    headlineTop: 'Record once.',
    headlineBottom: 'Replay forever.',
    sub: 'Captures real API responses while your Playwright suite runs locally, then replays them byte-for-byte on CI. No backend, no network, no hand-written mocks to maintain.',
    copyLabel: 'Copy',
    starCta: 'Star on GitHub',
    starCountAlt: 'GitHub star count',
    fine: 'MIT · TypeScript · works with Next.js & TanStack Start SSR, SPAs & Chrome extensions · WebSocket support',
  },

  demo: {
    heading: 'See it record, then replay',
    sub: 'One Playwright run records real responses to disk; flip to replay and the same suite passes with the backend off — no network.',
    videoLabel:
      'Screen recording: recording real API responses with test-proxy-recorder, then replaying them with the backend turned off.',
  },

  mechanisms: {
    heading: 'Two recorders, one proxy',
    sub: 'Requests originate in two places, so there are two recording mechanisms. Use either — or both together. Both record once and replay from disk, so CI runs with the backend off and no hand-written mocks.',
    proxy: {
      title: 'Proxy',
      flow: 'Next.js / TanStack Start SSR → proxy → real API',
      body: 'Sits between your server and the API. Records server-side requests — SSR fetches, route handlers, anything your backend-for-frontend calls.',
      when: 'For full-stack apps where the server calls the API.',
      exampleNextjs: 'View Next.js example →',
      exampleTanstack: 'View TanStack Start example →',
    },
    har: {
      title: 'HAR',
      flow: 'browser → HAR intercept → real API',
      bodyStart: 'Intercepts in the browser itself. Records client-side',
      bodyEnd: 'calls, Chrome extension API traffic, analytics, third-party APIs.',
      when: 'For SPAs, extensions, and browser-only apps.',
      exampleExtension: 'View Chrome extension example →',
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
      'Polly.js intercepts Node HTTP, so SSR mocking is possible inside the app process, but not as part of a Playwright run. MSW and Mocky Balboa replay real responses too — but you hand-write the mocks. When to reach for something else is covered in the',
    footLinkLabel: 'docs',
    footEnd: '.',
  },

  auth: {
    heading: 'Works with your real auth provider',
    sub: "Log in through Cognito, Auth0, Clerk, or WorkOS — for real, on every run. Only your app's API is recorded; auth stays live, your data goes offline.",
    links: {
      cognito: 'AWS Cognito example →',
      tanstack: 'Cognito on TanStack Start →',
      mock: 'Mock auth (no cloud account) →',
    },
  },

  quickStart: {
    heading: 'Set up in three steps',
    subStart:
      'Scaffold everything with one command, point your API at the proxy, then record and commit. Browser-only app?',
    subEnd: 'skips the SSR step for you.',
    ai: {
      heading: 'Fastest path: hand it to your AI agent',
      noteStart:
        'Copy this, swap in your backend URL, and paste it into Claude Code, Cursor, or any coding agent — it runs',
      noteMid: 'and finishes the wiring from the prompt',
      noteEnd: 'prints.',
      copyLabel: 'Copy',
    },
    manualIntro: 'Or wire it up by hand:',
    steps: {
      install: {
        title: 'Install & scaffold',
        noteStart: 'writes the proxy config, a Playwright fixture, a global teardown,',
        noteEnd:
          'scripts, and (on Next.js) wires SSR fetch tagging into your root layout — non-destructively.',
      },
      apiEnv: {
        title: "Point your app's API at the proxy",
        noteStart: 'The one thing',
        noteEnd:
          "can't guess: which env var holds your API base URL. Point it at the proxy when the recorder is enabled, at the real backend otherwise — the proxy never runs in production.",
        ssrStart: 'On Next.js,',
        ssrAfterInit: 'also adds',
        ssrAfterFn: 'to your root layout to tag server-side',
        ssrEnd: 'calls — a no-op in production:',
      },
      record: {
        title: 'Record, commit, replay',
        noteStart: 'Set',
        noteMid: ', run once against the real API, then flip to',
        noteEnd:
          "and commit. Recordings live in git — that's what makes CI deterministic. Don't gitignore them.",
      },
    },
  },

  cta: {
    heading: 'Stop hand-writing mocks',
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
