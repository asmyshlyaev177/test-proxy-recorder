# AGENTS — structure cheatsheet

Record/replay HTTP+WebSocket proxy for deterministic e2e tests. pnpm monorepo.

## Layout

```text
packages/
  test-proxy-recorder/   # the library + CLI (the product)
    src/
      ProxyServer.ts      # core: record / replay / transparent modes
      httpRecorder.ts     # capture & persist HTTP exchanges
      websocketHandlers.ts# WS record/replay
      replaySessions.ts   # per-test session keying (x-test-rcrd-id)
      cli.ts proxy-cli.ts proxy.ts  # `test-proxy-recorder` CLI entry
      init.ts             # `init` — auto-wire into a project
      config*.ts          # config load/merge
      reset.ts            # reset proxy mode
      nextjs/             # SSR helpers: registerProxyFetch / registerProxyAxios
                          #   / setNextProxyHeaders (middleware) / createHeadersWithRecordingId
      tanstack-start/     # TanStack Start SSR helpers: registerProxyFetch /
                          #   getRecordingId / createHeadersWithRecordingId
      recorderEnabled.ts  # shared isRecorderEnabled() gate for the adapters
      playwright/         # playwrightProxy fixture (before()/teardown())
      utils/              # redact, recordingId, cors, fileUtils, httpHelpers
    skills/               # AI agent skills (intent-managed; 500-line SKILL.md cap,
                          #   bulk in references/). Validate: npx intent validate <dir>
  landing/               # Astro Starlight docs site (the documentation site)
    src/content/docs/docs/  # English source of truth; other locales are translations
apps/                    # runnable examples + e2e suites (the proof the lib works)
  example-nextjs16, example-nextjs-edge, example-tanstack-start,
  example-websocket, example-auth-*, example-extension, example-init
```

Package exports: `.` (Playwright/core), `./playwright`, `./nextjs`, `./tanstack-start`. CLI bin: `test-proxy-recorder`.

## Commands (run from repo root)

```bash
pnpm build         # core library
pnpm lint
pnpm typecheck
pnpm test
pnpm example:test:e2e:ci                      # nextjs16 example — record then replay
pnpm example-edge:test:e2e:ci                 # edge example
pnpm example-tanstack:test:e2e:ci             # TanStack Start example
pnpm landing:dev
pnpm landing:build                            # docs site
pnpm landing:audits                           # accessibility + Lighthouse on the built docs site
```

## Site audits (docs site)

`pnpm landing:audits` → the token contract, then two Playwright projects driven by
`packages/landing/playwright.audits.config.ts`: `tests/a11y.spec.ts` and then
`tests/lighthouse.spec.ts`, which is held back by `dependencies: ['a11y']` so the
timing measurement has the box to itself. Everything lives in the landing package,
including the ~100 MB `lighthouse` dependency, because nothing else in the repo has
a use for it. `.github/workflows/lighthouse.yml` runs it on changes under
`packages/landing/**` and nowhere else. Both projects share one page list,
`tests/pages.ts`.

Both audit the **production build**, never `astro dev`: the `webServer` block runs
`pnpm run build && astro preview --port 4331`. Port 4331 is deliberately not 4321 —
both `astro dev` and `astro preview` default to that, and a dev server left running
would otherwise be silently accepted in place of the build.

### The accessibility gate

`tests/a11y.spec.ts` is one gate with two halves, both from
`@asmyshlyaev177/design-tokens` and both run against the same loaded page, in
**both themes** — Starlight's theme select defaults to `auto`, so the OS
preference is what picks the ramp on a first visit. Every assertion is
`expect.soft`, so an axe violation cannot hide a contrast failure beside it.

**axe**, at `COMPREHENSIVE_TAGS` (WCAG 2.0/2.1/2.2 A and AA, plus
`best-practice`). Its own contrast rules stay disabled by the package default —
the other half scores the same nodes on APCA as well as WCAG 2 — and
`incomplete` is asserted on, so text over a background image or an element below
the fold fails once and gets a decision rather than sitting unread.

**Rendered contrast** walks every visible text node and scores it against both
models. The floor is Lc 60, the weakest the token contract grants anything at
body size — not `--muted`'s 70. A DOM node does not say which token it used, so
a stricter floor fails sanctioned tokens.

Neither half is redundant with the Lighthouse accessibility score. Lighthouse
13.4 bundles axe-core 4.12 and runs 76 audits — 66 real rules plus 10 manual
checklist items that never execute — against axe's 104, in one theme only,
weighted into an average rather than a per-rule verdict. It scores no element
that holds no text node, which on a docs site is most of the chrome.

`integrations/expressive-code-a11y.mjs` is what the suite forced, and all three
of its parts close a gap the shipped defaults leave:

- **`liftThemeContrast`**, wired as expressive-code's `customizeTheme`. Night
  Owl leaves roughly a third of its tokens under the floor on Starlight's code
  background — comments worst, but keywords, punctuation and operators too. It
  raises each token's OKLCH lightness away from `theme.bg` until it clears both
  models, leaving hue and chroma alone.
- **`preTabIndex`**, an expressive-code plugin. EC's own client script gives an
  overflowing `<pre>` both `tabindex="0"` and `role="region"` with no accessible
  name, so every code block became an unnamed landmark (`landmark-unique`) —
  and until that script runs, 250 ms behind a ResizeObserver, the block is a
  scrollable region with no tab stop (`scrollable-region-focusable`). Setting
  the tab stop at build satisfies the second and takes the script's role branch
  out of play. The hast key is **`tabIndex`**; the lowercase spelling is dropped
  on serialisation without a word.
- **`rehypeScrollableTables`**, on the markdown pipeline. Starlight scrolls a
  wide table on the table element itself, and its content holds nothing
  focusable.

⚠ **Expressive-code output is cached in `.astro/`.** A change to the EC config
or to either plugin leaves already-rendered pages untouched, so a partial
rebuild reads as "the fix didn't work". `rm -rf .astro node_modules/.astro dist`
before trusting a result.

⚠ **`astro preview` backgrounds itself when it detects an AI agent**
(`isRunByAgent`, Astro 7). Playwright's `webServer` then sees the process exit
immediately and fails the run. CI is unaffected; locally, run the suite with
`env -u CLAUDECODE`.

Four colour decisions came out of the first run, and each names a rule:

- **`--primary` is a fill.** The comparison table's ✓ measured 2.92:1 on it.
  `--link` and `--accent-on-soft` are the two tokens with a checked floor, and
  the marks use one each so ✓ and ~ differ by hue as well as by shape.
- **No alpha tints of text tokens.** `--muted/55` has no contract; `--muted`
  does.
- **`--panel-rec` is a lamp, and a lamp is a fill.** The same colour worn as a
  glyph or a heading measured Lc 38-44, so `--panel-rec-text` is its own token,
  at the most chroma that round-trips through sRGB at a lightness that clears
  the floor on both panel grounds.
- **Starlight's dark `--sl-color-gray-3` carries the table of contents, the
  sidebar and the pagination labels at Lc 39**, and its `--sl-color-text-accent`
  carries prose links, inline code and the current entries at Lc 49-56. Both are
  re-pinned in `src/styles/docs.css`; the light ramp clears the floor untouched.

**Nine pages, one per template, not one per route.** The build emits **405**
documents (44 docs pages × 9 locales, the eight translated marketing pages and
the 404, with the English `/` served from the Worker on top of that) and
Starlight renders nearly all of them from one template, so auditing everything
would spend twenty minutes re-measuring three layouts. Each entry in `PAGES`
covers a shape the others don't: the marketing page, the Starlight index, a prose
guide, a page of expressive-code blocks, a TypeDoc-generated API page, a CJK
locale, and the 404. Add one when a genuinely new template lands — not when a new
page uses an existing one.

Desktop config, four categories, **100 on each** — measured August 2026, all seven
pages. Mobile is not what runs; it applies a 4× CPU slowdown that turns the
performance score into a measurement of the runner.

E2e flow: one `next build`, then `next start` serves a record phase (`RECORD_MODE=1`)
then a replay phase in one process. Record against `next start`, never `next dev`.

## Conventions

- Commit/PR only when asked; branch off `master` first. Co-author trailer required.
- **Never publish/release** without explicit approval.
- Docs: edit the English source under `landing/src/content/docs/docs/`; locale
  copies are translated separately — see Translations below.
- Skills mirror the library: keep `SKILL.md` concise, push detail into `references/`.

## Translations

Eight languages besides English: `zh-CN`, `ja`, `ko`, `ru`, `es`, `pt-BR`, `fr`,
`vi`. They are declared **once**, in `scripts/i18n/locales.mjs`, and everything
else derives from that list — the Starlight `locales` map, the sitemap's
`hreflang` alternates, the locale prefixes `/llms-full.txt` skips, and the
README suffixes. Adding a language is an edit there plus `pnpm i18n:init` and
`pnpm i18n:docs:init`.

Three surfaces, three addressing schemes, one toolkit:

| Surface | Where a translation lives | Tool |
| --- | --- | --- |
| `README.md` | `README.<tag>.md` beside it | `pnpm i18n` |
| Docs pages | `landing/src/content/docs/<dir>/docs/**` | `pnpm i18n:docs` |
| Homepage copy | `landing/src/i18n/home/<dir>.ts` | `pnpm i18n:copy` |

`<tag>` keeps BCP 47 case (`README.zh-CN.md`); `<dir>` is lowercase, because
content-collection ids and URLs are (`zh-cn/`, `pt-br/`).

The marketing homepage holds no words of its own. `src/components/HomePage.astro`
is the single implementation — structure, URLs, the install command and the
comparison data — and both routes render it: the unprefixed English `/`, which
stays `prerender = false` so `src/middleware.ts` can negotiate Markdown for
agents, and `src/pages/[locale]/index.astro`, which prerenders the eight
translated homepages. Agents get English; the locale roots never reach the
middleware, so they have one representation each and cannot be negotiated into
caching the wrong one.

**The docs sidebar carries no labels of its own.** Starlight resolves a `slug`
entry as `translations[lang] || label || frontmatter.sidebar.label ||
frontmatter.title`, so every page entry in `astro.config.mjs` omits `label`
entirely and each locale's sidebar reads that locale's translated page title.
The labels used to be spelled out there, identical to the English titles, and
that duplication is what pinned all nine sidebars to English. What is left —
the four group headings, the docs landing entry, the "Soon" badge — has no page
behind it and lives in `src/i18n/sidebar.ts`, which throws at build time if a
language is missing. The generated API reference group is the exception:
starlight-typedoc builds that group itself and keeps only the `badge` off the
placeholder, so its label stays English over an English subtree.

Copy is typed (`src/i18n/home/types.ts`), so a key a translator drops fails
`tsc` instead of silently leaving a paragraph in English. `<html lang>`,
`og:locale`, the hreflang cluster and the footer date all derive from the
locale — note `dateLocale()`, which keeps English on `en-GB` ("12 August 2026")
rather than letting a bare `en` flip it to the American order.

```bash
pnpm i18n:check        # READMEs: structure, links, anchors, drift
pnpm i18n:docs:check   # docs tree: same checks, per page
pnpm i18n:copy:check   # homepage copy modules: stamps and staleness
pnpm i18n:docs status  # what is translated, what has drifted
pnpm i18n diff ja      # the English diff a stale translation still owes
```

**Every translated file records the git blob hash of the English file it came
from** — an `<!-- i18n:meta … -->` line in a README, `i18nSource` /
`i18nSourceBlob` frontmatter in a docs page. That is what makes drift
detectable: without it a translation sits a release behind its source and
nothing says so, which is the state the first five languages here were found
in. Never hand-edit those fields; `pnpm i18n stamp <locale>` writes them once a
translation is brought current.

The English pages are the source of truth and are never edited to accommodate a
translation. `docs/reference/api/` is generated from TypeScript on every build
and stays English — Starlight falls back to English for any page a locale
doesn't have, which is the wanted behaviour there.

Handing the work to a model: `scripts/i18n/TRANSLATING.md` is the prompt and
`scripts/i18n/GLOSSARY.md` the protected-term list.
