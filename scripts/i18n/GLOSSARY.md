# Glossary — test-proxy-recorder

Hand this to any model or person translating this repo, together with
[TRANSLATING.md](./TRANSLATING.md).

## 1. Never translate, never transliterate, never inflect

These are identifiers a reader will type or search for. Copy them character for
character, keep their backticks, keep their capitalisation. If a sentence reads
awkwardly around one, rewrite the sentence — not the identifier.

**Configuration and lifecycle**
`defineConfig` · `Config` · `ProxyServer` · `Mode` · `startRecording` ·
`startReplay` · `stopProxy` · `setProxyMode` · `generateSessionId` ·
`playwrightProxy` · `PlaywrightTestInfo`

**Next.js integration**
`registerProxyFetch` · `registerProxyAxios` · `getRecordingId` ·
`createHeadersWithRecordingId` · `setNextProxyHeaders` · `ProxyAxiosInstance` ·
`ProxyAxiosRequestConfig`

**Recording and redaction**
`Recording` · `RecordingSession` · `WebSocketRecording` ·
`WebSocketReplayConfig` · `ControlRequest` · `redactSession` ·
`RedactionConfig` · `DEFAULT_REDACTED_HEADERS` · `REDACTED_PLACEHOLDER` ·
`RECORDING_ID_HEADER`

**Files and paths**
`test-proxy-recorder.config.ts` · `playwright.config.ts` · `.mock.json` ·
`e2e/fixtures.ts` · `e2e/global-teardown.ts` · `app/layout.tsx`

**Environment variables and CLI**
`TEST_PROXY_RECORDER_ENABLED` · `init` · `record` · `replay` · `--help`

## 2. Product and project names — keep in Latin script

`test-proxy-recorder` · Playwright · Next.js · TanStack Start · React Router ·
Remix · MSW · Polly.js · `playwright-network-cache` · Mocky Balboa · HAR ·
WebSocket · Node.js · npm · TypeScript · MIT · GitHub · Discord ·
`@tanstack/intent`

The comparison table lists competing tools by name. Those names are never
translated, and the table's y/n/p cells are data, not text.

## 3. Terms of art — translate, but pick one rendering and keep it

| English | Note |
| --- | --- |
| record / replay | The two modes. The single most important pair in the docs — pick one verb for each and never vary it. |
| VCR | The tagline metaphor ("VCR for Playwright"). Keep `VCR` in Latin; add a gloss on first use if your language needs one. |
| proxy | The tool itself sits between the app and the API. Use the standard networking term. |
| fixture | A Playwright fixture and, separately, a recorded response file. Context decides; keep them distinguishable. |
| mock | A hand-written stub — contrasted with a *recording* throughout. Do not merge the two words. |
| deterministic | The core promise: same response every run. |
| server-side (SSR) / browser-side | A structural distinction the docs lean on constantly. Keep them clearly opposed. |
| secret redaction | Replacing a credential's value with `[REDACTED]` before a recording is written to disk. **The cognate is a false friend in at least four languages** — it means *editing*, which is not what happens — and every one of them got it wrong on the first pass. The settled renderings are below; use them. |
| control endpoint | The HTTP endpoint that switches modes at runtime. |

### "Secret redaction", settled per language

The mechanism is masking: the proxy swaps a header's value for `[REDACTED]`.
Nothing is edited and nothing is deleted. Use these and inflect them normally;
the CLI flags stay `--redact-*` in every language.

| | noun | verb |
| --- | --- | --- |
| `zh-CN` | 涂抹 | 涂抹 |
| `ja` | マスキング | マスキングする |
| `ko` | 마스킹 | 마스킹하다 |
| `ru` | маскирование | маскировать |
| `es` | enmascaramiento (**m**) | enmascarar |
| `pt-BR` | remoção | remover |
| `fr` | masquage (**m**) | masquer |
| `vi` | loại bỏ | loại bỏ |

Spanish and French flipped gender when this was corrected — *la redacción* →
*el enmascaramiento*, *la rédaction* → *le masquage* — so articles, past
participles and clitic pronouns downstream of the noun moved with it.

## 4. Traps specific to this repo

- **The record/replay ASCII diagram** in the docs and on the homepage is inside
  a fenced block. The labels in it (`Browser/App`, `Proxy`, `Real API`,
  `Record mode`, `Replay mode`) are part of a drawing whose alignment depends
  on character width. Leave the whole block exactly as it is.
- **CJK and Vietnamese in ASCII diagrams** break the alignment even when the
  translation is correct. This is why the diagram is excluded.
- Docs pages carry `i18nSource` and `i18nSourceBlob` in their frontmatter.
  **Never edit or remove those two lines** — the tooling writes them.
- Frontmatter `title` and `description` **values** are translated; the **keys**
  are not.
- `docs/reference/api/` is generated from TypeScript on every build and is
  deliberately English-only. There is nothing to translate there.
