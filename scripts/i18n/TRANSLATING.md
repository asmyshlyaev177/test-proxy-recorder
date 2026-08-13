# Translating this repo

Instructions for the model — or person — producing the non-English content.
Read this and [GLOSSARY.md](./GLOSSARY.md) before touching a file.

You are translating developer documentation for a working open-source library.
The reader is a professional engineer who will copy commands out of it. They
are reading in their own language because it is easier, not because they cannot
read English — so a translation that is fluent but technically loose is worse
than useless. Precision first, then fluency.

## The languages

| Tag | Language | Files / directories |
| --- | --- | --- |
| `zh-CN` | Chinese (Simplified) | `*.zh-CN.md`, `zh-cn/` |
| `ja` | Japanese | `*.ja.md`, `ja/` |
| `ko` | Korean | `*.ko.md`, `ko/` |
| `ru` | Russian | `*.ru.md`, `ru/` |
| `es` | Spanish | `*.es.md`, `es/` |
| `pt-BR` | Portuguese (Brazil) | `*.pt-BR.md`, `pt-br/` |
| `fr` | French | `*.fr.md`, `fr/` |
| `vi` | Vietnamese | `*.vi.md`, `vi/` |

English is the source. It is never a target, and it is never edited to make a
translation work. If the English is wrong, say so in your report and translate
it faithfully anyway.

## What you are given

Every target file already exists, pre-filled with the English text and stamped
with the revision it came from. **You are editing files in place, not creating
them.** Do not create, rename or delete any file.

Two kinds of file:

- **A skeleton** — byte-identical English body. Translate the whole thing.
- **A stale translation** — already in your language, but behind the English.
  Do not retranslate it. Ask the tooling what changed and patch just that:

  ```bash
  pnpm i18n diff <locale>              # READMEs
  pnpm i18n:docs diff <locale> [page]  # docs pages
  ```

  That prints the English diff between the revision the file was translated
  from and the English text as it stands now. Apply the equivalent change.

## The files

| Path | What it is |
| --- | --- |
| `README.md` | English source. Never edit. |
| `README.<tag>.md` | Your README target, one per language, at the repo root. |
| `packages/landing/src/content/docs/docs/**` | English docs source, 15 pages. Never edit. |
| `packages/landing/src/content/docs/<dir>/docs/**` | Your docs target. |
| `packages/landing/src/i18n/home/en.ts` | English homepage copy. Never edit. |
| `packages/landing/src/i18n/home/<dir>.ts` | Your homepage target. |

### The homepage copy modules are TypeScript, not Markdown

`packages/landing/src/i18n/home/<dir>.ts` is the English module with its values
translated. The rules there are narrower and stricter:

- **Replace string values only.** Never add, remove, rename or reorder a key.
  The file is typed against `types.ts`, so a dropped key fails the build — but
  fix it rather than relying on that.
- **Leave the `// i18n:meta` line alone** except for `status=pending` →
  `status=translated`.
- Keep the JSDoc comments; they explain how split sentences reassemble. Some
  keys are fragments of one sentence that wraps an inline `<code>` in the
  markup — the JSDoc says so, and the fragments must still read as one sentence
  when joined in order. Word order differs between languages; if a split cannot
  work in yours, put the whole sentence in the first fragment and leave the
  others as empty strings rather than breaking the grammar.
- `meta.title` is a `<title>`: keep it under about 60 characters.
  `meta.description` is a search-result snippet: 150–160 characters.
- `meta.ogImageAlt` describes an image that is **English**. Describe what the
  image shows; do not translate it into a claim about a localised image.
- Escaping is TypeScript's: a `'` inside a single-quoted string needs `\'`, or
  switch that value to double quotes. Do not introduce template literals.

Verify with `pnpm --filter landing build`, not just by reading.

The docs directory for a language is lowercase: `zh-cn`, `pt-br`, `ja`, `ko`,
`ru`, `es`, `fr`, `vi`.

**`ko`, `pt-br` and `vi` are skeletons** — all 15 pages are still English.

**`es`, `fr`, `ja`, `ru` and `zh-cn` already exist and are stale.** All five are
missing content in `reference/ai-agent-skills.md` and `reference/examples.md`,
and all five have an outdated code block in
`getting-started/quick-start.md`. Their stamps say `unknown`, so `diff` cannot
help — compare against the English page directly. Additionally,
`es/docs/integrations/nextjs.md` contains a **typo'd URL**
(`asmyshylaev177` should be `asmyshlyaev177`) — fix it.

`docs/reference/api/` is generated from TypeScript and is English-only. Do not
create it in any language.

## Hard rules

These are checked mechanically. A file that breaks one of them is rejected.

### Never change

1. **Fenced code blocks.** Same number of blocks, same order, same language
   tag, same code. You **may** translate comments inside them — both whole-line
   (`// like this`) and trailing (`pnpm dev  # like this`). Nothing else in a
   block moves: not an identifier, not a string literal, not a URL, not a blank
   line, not the order of two lines.
2. **Link targets.** Same set of URLs as the English file, unchanged. Translate
   link *text*; never the address. Do not add links. Do not remove links.
3. **The heading tree.** Same number of headings, same levels, same order.
   Translate the text of each; never merge, split, add or drop one.
4. **Anything in the glossary's section 1.**
5. **Badges, shields.io URLs, HTML attributes** other than `alt` and `title`.
6. **The `<!-- i18n:start -->…<!-- i18n:end -->` block** at the top of a
   Markdown file, and the `i18nSource` / `i18nSourceBlob` frontmatter lines —
   except for the one field named in "Finishing" below. Tooling owns these.
7. **Numbers, versions, file sizes, file paths, environment variable names.**

### Always change

Prose, headings, list items, table cell text, blockquotes, image `alt` text,
button and link labels, and frontmatter `title` / `description` **values**
(never their keys).

### Anchors are generated, never written

Translating a heading changes the anchor GitHub derives from it, so every
in-page `](#…)` link that pointed at it breaks.

**Do not write anchors by hand and do not copy an English anchor.** Translate
the heading text, leave the table of contents alone, and run the TOC command in
"Finishing". It regenerates every anchor from your translated headings using
GitHub's own algorithm.

If a link points at a heading and there is no table of contents to regenerate,
derive the anchor the same way: lowercase, drop punctuation except `-` and `_`,
spaces to `-`, keep the Unicode as-is, and add `-1`, `-2` for duplicates.

## Style

- **Register**: the register of good technical documentation in your language.
  Chinese and Japanese docs are plainer than English marketing prose — do not
  import English enthusiasm. Russian, French and Spanish technical writing
  tolerates longer sentences than English; use them if they read better.
- **Second person**: use whatever developer docs in your language normally use
  (Japanese です/ます, Russian «вы», French *vous*, Spanish *tú* or the
  impersonal, Vietnamese *bạn*).
- **Spacing**: put a space between CJK text and adjacent Latin words or
  `inline code`. It is the convention in every major Chinese and Japanese
  technical style guide and the text is unreadable without it.
- **Punctuation**: use your language's own. Chinese and Japanese take full-width
  `，。（）`; French takes its narrow no-break spaces before `: ; ! ?`; Spanish
  takes `¿` and `¡`.
- **Headings**: keep them short. A heading that wraps to three lines in the
  sidebar is a bad heading no matter how accurate.
- **Untranslatable jokes and idioms**: replace with the plainest accurate
  statement of what the sentence means. Do not attempt an equivalent joke.
- **First occurrence of a term of art**: if your language has no settled word,
  give your translation and put the English in parentheses once, then use your
  translation from then on.

## Finishing

For each file you finish:

1. In the `<!-- i18n:meta … -->` line, change `status=pending` to
   `status=translated`. That is the only part of the managed block you touch.
   (Files under a locale *directory* have no such line — skip this step.)
2. Run the repo's check command below and fix anything it reports.

```bash
pnpm i18n:check        # structural validation of the READMEs
pnpm i18n:docs:check   # structural validation of the docs tree
pnpm i18n:copy:check   # homepage copy modules: stamps and staleness
pnpm --filter landing build   # the real gate: the site must build
```

A clean run means the structure survived. It says nothing about whether the
translation is good — that is on you.

## Reporting

When you are done, report:

- Which files you translated, and which you patched rather than retranslated.
- Every place the English was ambiguous, wrong, or impossible to render
  faithfully, and what you did about it.
- Every term you had to invent because your language has no settled equivalent.

Do not silently smooth over a problem in the source. Flag it.
