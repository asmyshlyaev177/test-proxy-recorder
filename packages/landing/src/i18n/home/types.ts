// The shape of the homepage copy: one entry per user-facing string, grouped by
// the section of the page it appears in.
//
// It lives apart from en.ts so that a locale module is a *verbatim copy* of the
// English one with its values replaced — nothing to keep in sync by hand, and a
// key that a translator drops or renames is a type error rather than a silently
// English paragraph.

export interface HomeCopy {
  /** <head> text. Distinct from the hero copy: written for a search result. */
  meta: {
    /** <title>, og:title, twitter:title. */
    title: string;
    /** <meta name="description">, og:description, twitter:description. */
    description: string;
    /** Describes the shared og.png, which is itself English-only. */
    ogImageAlt: string;
  };

  /** Header, footer and the skip link — everything outside <main>. */
  chrome: {
    skipToContent: string;
    navQuickStart: string;
    navDocs: string;
    /** Precedes the date in the footer: "Updated 13 August 2026". */
    updated: string;
    licensed: string;
    /** aria-label on the language menu. */
    languageLabel: string;
    /** A copy button's label for a moment after a successful copy. */
    copied: string;
  };

  hero: {
    /** The page's <h1>: what the tool does, in the words people search for. */
    title: string;
    /** The display line under the h1; the markup breaks the line between the two. */
    headlineTop: string;
    headlineBottom: string;
    sub: string;
    /** Label on the copy-to-clipboard button beside the install command. */
    copyLabel: string;
    starCta: string;
    /** One-line list of licence, language and supported stacks under the CTAs. */
    fine: string;
    /** The hero animation's pause control, and its label while paused. */
    scenePause: string;
    scenePlay: string;
  };

  demo: {
    heading: string;
    sub: string;
    /** aria-label on the demo <video>. */
    videoLabel: string;
  };

  mechanisms: {
    heading: string;
    sub: string;
    proxy: {
      title: string;
      /** Request path shown in mono type under the card title. */
      flow: string;
      body: string;
      /** Bold one-liner: which kind of app this mechanism is for. */
      when: string;
      /** How a server-side request is tied to its test under parallel workers. */
      parallel: string;
      guideNextjs: string;
      guideTanstack: string;
      exampleNextjs: string;
      exampleTanstack: string;
    };
    har: {
      title: string;
      flow: string;
      /** bodyStart + `fetch` + bodyEnd */
      bodyStart: string;
      bodyEnd: string;
      when: string;
      /** What the HAR path adds over plain routeFromHAR. */
      proxyNote: string;
      guidePlaywright: string;
      exampleExtension: string;
      exampleVite: string;
    };
  };

  compare: {
    heading: string;
    sub: string;
    /** Visually hidden <caption> describing the table for screen readers. */
    tableCaption: string;
    /** Visually hidden header for the first column, which holds the row labels. */
    featureLabel: string;
    /** Row labels down the left of the table, in order. */
    features: readonly string[];
    /** Visually hidden text equivalents for the ✓ / ✕ / ~ glyphs. */
    markText: { y: string; n: string; p: string };
    /** footStart + "docs" link + footEnd */
    footStart: string;
    footLinkLabel: string;
    footEnd: string;
    /** The honest cost, under the table: a more involved first setup. */
    tradeoff: string;
  };

  auth: {
    heading: string;
    sub: string;
    links: {
      cognito: string;
      tanstack: string;
      mock: string;
    };
  };

  /** After the mechanisms: a real recording beside the three facts it shows. */
  recordingSample: {
    heading: string;
    perTest: {
      term: string;
      /** start + `npx playwright test -g "adds a todo"` + end */
      start: string;
      end: string;
    };
    testId: {
      term: string;
      /** start + `x-test-rcrd-id` + mid + `registerProxyFetch()` + end */
      start: string;
      mid: string;
      end: string;
    };
    /** `link` labels a link to the docs page that covers the row, as in replayQuestions. */
    secrets: { term: string; body: string; link: string };
    /** Under the sample recording. */
    caption: string;
  };

  /** After Quick start: where replay stops being exact, one question per row. */
  replayQuestions: {
    heading: string;
    matching: { term: string; body: string; link: string };
    misses: {
      term: string;
      /** start + `url` + mid + `before()` + end */
      start: string;
      mid: string;
      end: string;
    };
    liveApi: {
      term: string;
      /** start + `teardown()` + end */
      start: string;
      end: string;
      link: string;
    };
    drift: { term: string; body: string };
    overrides: {
      term: string;
      /** start + `page.route()` + mid + `before()` + end */
      start: string;
      mid: string;
      end: string;
      link: string;
    };
  };

  quickStart: {
    heading: string;
    /** subStart + `init` + subEnd */
    subStart: string;
    subEnd: string;
    /** The two setup tabs. */
    tabs: {
      agent: string;
      manual: string;
    };
    ai: {
      /** noteStart + `init` + noteEnd */
      noteStart: string;
      noteEnd: string;
      /** The button that copies the prompt. */
      copyLabel: string;
    };
    /** Who has to change what: the test suite, and the app (only for SSR). */
    changes: {
      /** Heading over the three bullets, so they don't read as the setup steps. */
      label: string;
      tests: string;
      /** appStart + `registerProxyFetch()` + appEnd */
      appStart: string;
      appEnd: string;
      /** The one write the agent path adds: @tanstack/intent's guidance in the agent's config. */
      agent: string;
      deployed: string;
    };
    steps: {
      install: {
        title: string;
        /** `init` + noteStart + `package.json` + noteEnd */
        noteStart: string;
        noteEnd: string;
      };
      apiEnv: {
        title: string;
        /** noteStart + `init` + noteEnd */
        noteStart: string;
        noteEnd: string;
        /** ssrStart + `init` + ssrAfterInit + `registerProxyFetch()` + ssrAfterFn + `fetch` + ssrEnd */
        ssrStart: string;
        ssrAfterInit: string;
        ssrAfterFn: string;
        ssrEnd: string;
        /** When a browser-only app can skip the step. */
        browserOnly: string;
      };
      record: {
        title: string;
        /** noteStart + `MODE = 'record'` + noteMid + `'replay'` + noteEnd */
        noteStart: string;
        noteMid: string;
        noteEnd: string;
      };
    };
    /** Link to the full setup guide in the docs, under the tabs. */
    guideLink: string;
  };

  cta: {
    heading: string;
    sub: string;
    copyLabel: string;
    starCta: string;
    /** fineStart + issue link + fineBetween + Discord link + fineEnd */
    fineStart: string;
    issueLabel: string;
    fineBetween: string;
    discordLabel: string;
    fineEnd: string;
  };
}
