# Product

## Register

brand

> Default register is **brand**: the primary design surface is the (future) landing/docs page for the `test-proxy-recorder` npm package, where design is the product. The monorepo also contains product-register surfaces — the example apps (`apps/example-nextjs16`, `apps/example-extension`) act as living documentation and e2e fixtures; override to `product` when working on them.

## Users

Playwright/test engineers — developers writing or maintaining e2e test suites who are tired of flaky network-dependent CI runs and hand-written mocks. They arrive from npm, GitHub, or a search for "playwright record replay", skim fast, and judge the tool by how quickly the page proves it works. They read the example apps as documentation, so example code quality is part of the product surface.

## Product Purpose

`test-proxy-recorder` records real API responses during Playwright test runs (server-side via proxy, browser-side via HAR) and replays them deterministically on CI — no backend, no manual mocks. The landing/docs page exists to convert a skeptical developer in under a minute: explain the record/replay model clearly, show real configuration code, and get them to `npm install`. Success = a developer understands the two recording mechanisms and trusts the tool enough to try it.

## Brand Personality

**Calm technical authority.** Confident, precise, understated — the tool works; the page doesn't shout. Three words: *deterministic, precise, quiet*. Emotional goal: the relief of tests that just pass — stability, not excitement.

References:
- **linear.app** — for polish-as-proof: design quality signals product quality.
- **vitest.dev / vite.dev** — for distinct identity with restrained color and strong DX storytelling.
- Open to a direction that sidesteps currently saturated dev-tool aesthetics entirely; the references are about *qualities* (polish, restraint, identity), not lanes to copy.

## Anti-references

- **Corporate enterprise** — stocky, navy-suited, "Request a demo" energy. Wrong for an open-source dev tool.
- **Overdesigned / motion-heavy** — scroll-jacking, parallax, glassmorphism, anything that gets between a developer and the docs.
- Saturated dev-tool template lanes (dark-mode-with-glow hero, gradient text on black) — avoid the second-order reflex, not just the first.

## Design Principles

1. **Show, don't tell.** Real code, real `.mock.json` output, real record→replay flows are the hero content. The tool's own artifacts are the marketing.
2. **Clarity is credibility.** Developers judge the tool by how precisely the page explains the proxy/HAR model. Diagrams and exact copy beat adjectives.
3. **Practice what we preach.** The tool's pitch is fast and deterministic; the page must be too. Instant load, no flaky animation, motion only where it explains something.
4. **Examples are documentation.** The example apps get read as reference implementations — keep them production-credible, minimal, and current.
5. **Quiet confidence.** Restrained palette, one committed accent, typography does the talking. No shouting.

## Accessibility & Inclusion

WCAG 2.1 AA: ≥4.5:1 body-text contrast, full keyboard navigation, visible focus states, `prefers-reduced-motion` alternatives for every animation. Code blocks and diagrams need accessible text equivalents.
