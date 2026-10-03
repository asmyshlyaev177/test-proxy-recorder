// French (fr) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=fr source=en.ts source-blob=c698d86206f541e55eef9064035f21550ca9a188 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: "Playwright : enregistrer et rejouer les appels d'API, SSR inclus",
    description:
      "Enregistrez les vraies réponses d'API d'un run Playwright et rejouez-les en CI : fetches côté serveur Next.js et TanStack Start, appels navigateur, WebSockets.",
    ogImageAlt:
      'test-proxy-recorder — enregistrez une fois, rejouez pour toujours. Schéma des modes enregistrement et rejeu.',
  },

  chrome: {
    skipToContent: 'Aller au contenu',
    navQuickStart: 'Démarrage rapide',
    navDocs: 'Docs',
    updated: 'Mis à jour',
    licensed: 'Sous licence MIT.',
    languageLabel: 'Langue',
    copied: 'Copié',
  },

  hero: {
    title: "Enregistrer et rejouer les appels d'API dans les tests Playwright, y compris les requêtes côté serveur",
    headlineTop: 'Enregistrez une fois.',
    headlineBottom: 'Rejouez pour toujours.',
    sub: "Enregistre les réponses d'API que votre app reçoit pendant une exécution Playwright en local, WebSockets compris, puis les rejoue en CI avec votre backend éteint.",
    copyLabel: 'Copier',
    starCta: 'Mettre une étoile sur GitHub',
    fine: 'MIT · TypeScript · Node ≥ 20 · SSR Next.js & TanStack Start, SPA, extensions Chrome, WebSockets',
    scenePause: 'Pause',
    scenePlay: 'Lecture',
  },

  demo: {
    heading: 'Voyez-le enregistrer, puis rejouer',
    sub: 'Une exécution Playwright enregistre de vraies réponses sur le disque ; basculez en rejeu et la même suite passe avec le backend éteint.',
    videoLabel:
      "Enregistrement d'écran : enregistrement des vraies réponses d'API avec test-proxy-recorder, puis rejeu avec le backend éteint.",
  },

  mechanisms: {
    heading: "Deux façons d'enregistrer",
    sub: "Les requêtes partent de deux endroits, il y a donc deux façons de les enregistrer, et le processus du proxy tourne dans les deux cas. Tout ce qui est envoyé au proxy (fetches côté serveur, appels du navigateur via une URL de base d'API partagée avec le serveur, WebSockets) est rejoué depuis le .mock.json du test. Les appels du navigateur vers d'autres hôtes qui correspondent au motif url de votre fixture sont rejoués depuis le .har du test.",
    proxy: {
      title: 'Proxy',
      flow: 'SSR Next.js / TanStack Start → proxy → vraie API',
      body: "Se place entre votre serveur et l'API. Enregistre les requêtes côté serveur : fetches des Server Components et du SSR, route handlers, tout ce que votre backend-for-frontend appelle.",
      when: "Pour les apps full-stack où le serveur appelle l'API.",
      parallel: "Les requêtes côté serveur de chaque test portent l'id de ce test, donc des tests exécutés en parallèle ne partagent jamais un enregistrement.",
      guideNextjs: 'Guide Next.js →',
      guideTanstack: 'Guide TanStack Start →',
      exampleNextjs: "Voir l'exemple Next.js →",
      exampleTanstack: "Voir l'exemple TanStack Start →",
    },
    har: {
      title: 'HAR',
      flow: 'navigateur → interception HAR → vraie API',
      bodyStart: 'Intercepte dans le navigateur lui-même et sauvegarde un fichier HTTP Archive (HAR). Enregistre les appels',
      bodyEnd: "côté client, le trafic des API d'extensions Chrome, l'analytics et les API tierces, dès lors qu'ils correspondent au motif url de votre fixture.",
      when: 'Pour les SPA, les extensions et les apps uniquement navigateur.',
      proxyNote:
        "Par rapport à un simple routeFromHAR, il ajoute un HAR par test et masque les en-têtes d'authentification.",
      guidePlaywright: 'Guide Playwright →',
      exampleExtension: "Voir l'exemple d'extension Chrome →",
      exampleVite: "Voir l'exemple Vite + WebSocket →",
    },
  },

  compare: {
    heading: 'Où il se situe',
    sub: 'Les outils de mocking excellent à des tâches différentes. La combinaison ci-dessous — enregistrer du trafic réel à travers le SSR, le navigateur et les WebSockets, sans mocks écrits à la main — est le vide que les autres laissent ouvert.',
    tableCaption:
      'Comparaison des fonctionnalités de test-proxy-recorder avec Playwright routeFromHAR, MSW, Polly.js, playwright-network-cache et Mocky Balboa.',
    featureLabel: 'Fonctionnalité',
    features: [
      'Enregistre le trafic réel',
      'Côté serveur (SSR)',
      'Côté navigateur',
      'WebSocket',
      'Natif Playwright',
      'Maintenu',
    ],
    markText: { y: 'Oui', n: 'Non', p: 'Partiel' },
    footStart:
      "Polly.js enregistre dans le processus où il s'exécute : pour les requêtes côté serveur, il doit donc tourner dans le serveur de votre app. MSW et Mocky Balboa mockent aussi les requêtes côté serveur, mais vous écrivez les réponses vous-même. La comparaison complète, avec les sources et les cas où choisir un autre outil, se trouve dans les",
    footLinkLabel: 'docs',
    footEnd: '.',
    tradeoff:
      "La contrepartie est une première mise en place plus lourde qu'avec les outils limités au navigateur : un processus proxy tourne à côté de vos tests et, pour les requêtes côté serveur, l'URL de base de l'API de votre app pointe vers lui pendant les tests.",
  },

  auth: {
    heading: "Fonctionne avec votre vrai fournisseur d'authentification",
    sub: "Connectez-vous via Cognito, Auth0, Clerk ou WorkOS — pour de vrai, à chaque exécution. Seule l'API de votre app est enregistrée ; l'authentification reste en direct, vos données passent hors ligne.",
    links: {
      cognito: 'Exemple AWS Cognito →',
      tanstack: 'Cognito sur TanStack Start →',
      mock: 'Authentification mock (sans compte cloud) →',
    },
  },

  recordingSample: {
    heading: 'À quoi ressemble un enregistrement',
    perTest: {
      term: 'Un fichier par test',
      start: "Chaque test écrit son propre fichier, nommé d'après le test, donc",
      end: 'ne réenregistre que celui-là. Le proxy enregistre un test à la fois : enregistrez donc avec un seul worker ; le rejeu, lui, tourne en parallèle.',
    },
    testId: {
      term: "L'id du test",
      start: 'Playwright envoie',
      mid: "avec chaque requête d'un test, et",
      end: 'le recopie sur les fetches que fait votre serveur. Le proxy le lit pour répondre à chaque test depuis le fichier propre à ce test, même quand les tests sont rejoués en parallèle.',
    },
    secrets: {
      term: 'Secrets',
      body: "Les en-têtes Authorization, Cookie et Set-Cookie deviennent [REDACTED] dans les fichiers .mock.json avant leur écriture, et dans les fichiers .har à la fin de l'exécution. Les secrets contenus dans les corps de réponse demandent vos propres motifs.",
      link: 'Masquage des secrets →',
    },
    caption:
      "Extrait d'un vrai enregistrement, 2.6 KB au total : le POST d'un test, avec son en-tête Authorization masqué. Le fichier complet contient aussi le GET qui a suivi, tous les en-têtes et un horodatage pour chaque requête.",
  },

  replayQuestions: {
    heading: 'Questions sur le rejeu',
    matching: {
      term: 'Comment les requêtes sont-elles mises en correspondance ?',
      body: "Le proxy met en correspondance un appel côté serveur selon sa méthode, son chemin et sa query string exacte, pas selon son corps, et sert les appels répétés dans l'ordre où ils ont été enregistrés. Les appels du navigateur suivent les règles HAR de Playwright, qui comparent aussi les corps des POST. Une query string qui change à chaque exécution, comme un horodatage, ne correspond jamais, et aucune option ne permet d'ignorer un paramètre : gardez donc ces valeurs fixes pendant les tests.",
      link: 'Correspondance des requêtes en rejeu →',
    },
    misses: {
      term: 'Et si un enregistrement manque ?',
      start:
        "Le proxy répond 404 en nommant la requête et le test. Un appel fait plus de fois qu'il n'a été enregistré reçoit de nouveau la dernière réponse, avec un avertissement dans le log du proxy. Dans le navigateur, Playwright interrompt un appel qui correspond au motif",
      mid: 'que votre fixture passe à',
      end: "mais qui n'est pas dans le HAR ; les autres appels atteignent le réseau.",
    },
    liveApi: {
      term: 'Quand le rejeu atteint-il la vraie API ?',
      start:
        "Le rejeu n'atteint la vraie API qu'une fois que le proxy a quitté le mode rejeu, et le proxy garde un seul mode pour tous les tests en cours. Il quitte le mode rejeu 120 secondes après le démarrage du dernier test, ou quand un hook par test appelle",
      end: '. Sans backend lancé en CI, un tel appel échoue au lieu de passer.',
      link: 'Timeout de session et teardown →',
    },
    drift: {
      term: "Que se passe-t-il quand l'API change ?",
      body: "Avec un client d'API typé, mettre à jour le client pour un champ modifié fait échouer les tests rejoués qui l'utilisent, car les enregistrements contiennent encore l'ancien champ. Cela vous indique ce qui a changé, et réenregistrer corrige les tests avec moins de travail que de modifier des mocks écrits à la main.",
    },
    overrides: {
      term: 'Comment tester les erreurs et les cas limites ?',
      start: 'Dans le navigateur, un',
      mid: 'ajouté après',
      end: "a priorité sur l'enregistrement. Les réponses côté serveur se modifient dans le fichier .mock.json.",
      link: 'Forcer une réponse →',
    },
  },

  quickStart: {
    heading: 'Démarrage rapide',
    subStart:
      'Scaffoldez tout avec une commande, pointez votre API vers le proxy, puis enregistrez et committez. App uniquement navigateur ?',
    subEnd: "saute l'étape SSR pour vous.",
    tabs: {
      agent: 'Avec votre agent IA',
      manual: 'À la main',
    },
    ai: {
      noteStart:
        "Collez ceci dans Claude Code, Cursor ou un autre agent de codage. Il lance d'abord @tanstack/intent, qui ajoute des consignes au fichier de configuration de votre agent, par exemple CLAUDE.md, pour que l'agent charge les skills de configuration de cette bibliothèque. Ensuite, il installe le paquet, trouve l'URL de votre backend dans la configuration de l'app, lance",
      noteEnd: 'et termine le branchement à partir de sa sortie.',
      copyLabel: 'Copier le prompt',
    },
    changes: {
      label: 'Ce qui change dans votre dépôt',
      tests:
        'Dans votre suite de tests : une fixture Playwright, le processus du proxy (il ne tourne que pendant les tests) et des enregistrements committés dans git.',
      appStart:
        "Dans votre app, uniquement pour les requêtes côté serveur : pointez l'URL de base de l'API vers le proxy pendant les tests, et appelez",
      appEnd:
        "une fois, dans app/layout.tsx sur Next.js ou src/router.tsx sur TanStack Start. Il recopie l'id du test sur chaque fetch côté serveur et ne fait rien en production, sauf si TEST_PROXY_RECORDER_ENABLED est défini.",
      agent:
        'Avec le prompt pour agent : @tanstack/intent ajoute au fichier de configuration de votre agent, par exemple CLAUDE.md, des consignes pour charger les skills de cette bibliothèque.',
      deployed:
        "Vous testez un environnement déployé ? HAR enregistre ses appels navigateur sans aucun changement dans l'app, mais les pages elles-mêmes se chargent toujours depuis ce serveur. Pour rejouer aussi les appels côté serveur, lancez l'app en CI à côté du proxy.",
    },
    steps: {
      install: {
        title: 'Installer et scaffolder',
        noteStart: 'écrit la config du proxy, une fixture Playwright, un teardown global, des scripts dans',
        noteEnd:
          'et (sur Next.js) branche le marquage des fetches SSR dans votre root layout — sans rien écraser.',
      },
      apiEnv: {
        title: "Pointer les appels d'API côté serveur vers le proxy",
        noteStart: 'La seule chose que',
        noteEnd:
          "ne peut pas deviner : quelle variable d'environnement contient l'URL de base de votre API. Pointez-la vers le proxy lorsque le recorder est activé, vers le vrai backend sinon — le proxy ne tourne jamais en production.",
        ssrStart: 'Sur Next.js,',
        ssrAfterInit: 'ajoute aussi',
        ssrAfterFn: 'à votre root layout pour tagger les',
        ssrEnd: 'côté serveur — un no-op en production.',
        browserOnly:
          "App uniquement navigateur ? Sautez cette étape, sauf si l'app ouvre des WebSockets : ils ne sont enregistrés que s'ils se connectent à l'adresse du proxy.",
      },
      record: {
        title: 'Enregistrer, committer, rejouer',
        noteStart: 'Définissez',
        noteMid: ', exécutez une fois contre la vraie API, puis basculez sur',
        noteEnd:
          "et committez. Les enregistrements vivent dans git — c'est ce qui rend la CI déterministe. Ne les gitignorez pas.",
      },
    },
    guideLink: 'Guide de configuration complet →',
  },

  cta: {
    heading: "Arrêtez d'écrire des mocks à la main",
    sub: 'Votre API donne déjà les bonnes réponses. Enregistrez-les.',
    copyLabel: 'Copier',
    starCta: 'Mettre une étoile sur GitHub',
    fineStart:
      "Si ça vous a épargné un après-midi, une étoile prend une seconde — c'est ainsi que la prochaine personne le trouve, et cela dit à un mainteneur solo de continuer à construire. Vous avez un souci ou une idée ?",
    issueLabel: 'Ouvrir une issue',
    fineBetween: 'ou',
    discordLabel: 'rejoindre Discord',
    fineEnd: '.',
  },
};
