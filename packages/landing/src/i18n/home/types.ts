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
  };

  hero: {
    eyebrow: string;
    /** First line of the h1; the markup breaks the line between the two. */
    headlineTop: string;
    headlineBottom: string;
    sub: string;
    /** Label on the copy-to-clipboard button beside the install command. */
    copyLabel: string;
    starCta: string;
    /** alt for the third-party star-count badge image. */
    starCountAlt: string;
    /** One-line list of licence, language and supported stacks under the CTAs. */
    fine: string;
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
      exampleExtension: string;
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

  quickStart: {
    heading: string;
    /** subStart + `init` + subEnd */
    subStart: string;
    subEnd: string;
    ai: {
      heading: string;
      /** noteStart + `init` + noteMid + `init` + noteEnd */
      noteStart: string;
      noteMid: string;
      noteEnd: string;
      copyLabel: string;
    };
    /** Lead-in to the numbered steps, under the AI shortcut. */
    manualIntro: string;
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
      };
      record: {
        title: string;
        /** noteStart + `MODE = 'record'` + noteMid + `'replay'` + noteEnd */
        noteStart: string;
        noteMid: string;
        noteEnd: string;
      };
    };
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
