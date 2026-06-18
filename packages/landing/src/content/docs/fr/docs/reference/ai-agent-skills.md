---
title: Skills pour agents IA
description: Installez les skills de test-proxy-recorder pour que les agents de code IA (Claude Code, Cursor, Copilot) génèrent du code de configuration correct.
---

Si vous utilisez un agent de code IA (Claude Code, Cursor, Copilot et similaires), installez les skills de cette bibliothèque pour que l'agent génère du code de configuration correct :

```bash
npx @tanstack/intent@latest install
```

Cela ajoute les skills de `test-proxy-recorder` à votre projet. L'agent connaîtra alors la bonne configuration de proxy/fixture, le flux enregistrer vs. rejouer et les motifs d'en-têtes SSR de Next.js sans avoir besoin d'être guidé.

## Maintenir les skills (pour les contributeurs)

Les skills de l'agent se trouvent dans [`packages/test-proxy-recorder/skills/`](https://github.com/asmyshlyaev177/test-proxy-recorder/tree/master/packages/test-proxy-recorder/skills). Vérifiez-les périodiquement — et chaque fois que l'API de la bibliothèque ou les exemples changent :

```bash
npx @tanstack/intent@latest validate   # structure/format/line-limit checks (run before committing skill edits)
npx @tanstack/intent@latest stale      # flags version drift vs the published library — re-review the skills it lists
```

`validate` doit passer ; `stale` est indicatif — quand il signale une dérive après une release, relisez le contenu de la skill concernée (et incrémentez son `library_version`).
