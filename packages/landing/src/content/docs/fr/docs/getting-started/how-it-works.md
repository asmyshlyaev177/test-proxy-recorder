---
title: Comment ça marche
description: test-proxy-recorder enregistre le trafic via deux mécanismes — un proxy pour les requêtes côté serveur et HAR pour les requêtes côté navigateur. Utilisez-les ensemble ou séparément.
---

test-proxy-recorder prend en charge deux mécanismes d'enregistrement selon l'origine de vos requêtes. Les deux peuvent être utilisés ensemble ou indépendamment.

| Mécanisme | Ce qu'il enregistre | Cas d'usage |
| --------- | --------------- | -------- |
| **Proxy** (`.mock.json`) | Requêtes côté serveur (fetches SSR de Next.js, etc.) | Apps full-stack où le serveur appelle l'API |
| **HAR** (`.har`) | Requêtes côté navigateur (`fetch` du navigateur, extensions, SPA) | SPA, extensions Chrome, API tierces |

```text
  Server-side (proxy)                    Browser-side (HAR)

  Next.js SSR ──> Proxy ──> Real API     Browser ──> HAR intercept ──> Real API
                    │                                      │
                    └──> .mock.json                        └──> .har
```

Chaque mode est défini par session de test. En mode **record**, le proxy transmet au vrai backend et sauvegarde les réponses ; en mode **replay**, il sert les réponses sauvegardées depuis le disque ; en mode **transparent**, il transmet sans enregistrer. Voir l'[endpoint de contrôle](/fr/docs/guides/control-endpoint/) pour savoir comment les modes sont changés.
