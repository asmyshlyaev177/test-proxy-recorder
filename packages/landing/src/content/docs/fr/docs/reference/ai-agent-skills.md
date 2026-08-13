---
title: Skills pour agents IA
description: Installez les skills de test-proxy-recorder pour que les agents de code IA (Claude Code, Cursor, Copilot) génèrent du code de configuration correct.
i18nSource: docs/reference/ai-agent-skills.md
i18nSourceBlob: 2622ae8f436b9a9a1d57fdf8831308a039a8981d
---

Si vous utilisez un agent de codage IA (Claude Code, Cursor, Copilot et similaires), configurez le chargement des skills afin que l'agent génère le bon code de configuration. Les skills sont fournies dans le paquet `test-proxy-recorder` via [`@tanstack/intent`](https://www.npmjs.com/package/@tanstack/intent) et suivent ses mises à jour habituelles de gestionnaire de paquets.

**1. Installez la bibliothèque** (les skills sont découvertes depuis les paquets installés) :

```bash
npm install --save-dev test-proxy-recorder
```

**2. Écrivez le guide de l'agent** — `install` ajoute des instructions de découverte à la config de votre agent (`CLAUDE.md`, `.cursorrules`, etc.) afin que l'agent charge les skills de paquet correspondantes à la demande :

```bash
npx @tanstack/intent@latest install
```

Passez `--map` si vous préférez écrire des correspondances explicites tâche→skill dans la config de votre agent plutôt que des instructions de découverte génériques.

L'agent connaîtra alors la bonne configuration proxy/fixture, le flux enregistrer vs. rejouer et les motifs d'en-têtes SSR de Next.js sans avoir besoin d'être guidé.

## Les skills

`test-proxy-recorder` fournit ces skills :

- **`proxy-setup`** — le CLI du proxy, les scripts `package.json`, le `webServer` de `playwright.config.ts`, les fixtures par test, les modes record/replay/transparent, le masquage des secrets et le cycle de vie enregistrer-une-fois → commit → rejeu-en-CI.
- **`nextjs-ssr`** — le marquage des fetches côté serveur avec `registerProxyFetch` / `registerProxyAxios` / `createHeadersWithRecordingId`, la mise en garde build-and-start vs `next dev` et pourquoi le middleware est optionnel.
- **`tanstack-start`** — le marquage des loaders, des fonctions serveur et des routes serveur de TanStack Start, la mise en garde build vs `vite dev`, la séparation des URL d'API serveur vs navigateur, le préchargement SSR de TanStack Query et le motif d'authentification réelle.

Listez ce qui est disponible parmi vos paquets installés, ou chargez-en une directement :

```bash
npx @tanstack/intent@latest list                          # affiche les skills découvrables
npx @tanstack/intent@latest load test-proxy-recorder#proxy-setup
npx @tanstack/intent@latest load test-proxy-recorder#nextjs-ssr
npx @tanstack/intent@latest load test-proxy-recorder#tanstack-start
```

## Maintenir les skills (pour les contributeurs)

Les skills de l'agent se trouvent dans [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills). Vérifiez-les périodiquement — et chaque fois que l'API de la bibliothèque ou les exemples changent :

```bash
npx @tanstack/intent@latest validate   # vérifications structure/format/limite-de-lignes (à exécuter avant de committer des modifications de skills)
npx @tanstack/intent@latest stale      # signale une dérive de version par rapport à la bibliothèque publiée — relisez les skills qu'il liste
```

`validate` doit passer ; `stale` est indicatif — quand il signale une dérive après une release, relisez le contenu des skills concernées (et incrémentez leur `library_version`).
