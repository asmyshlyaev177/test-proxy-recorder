// French (fr) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=fr source=en.ts source-blob=0e5944e1211d8ba9dcc934fd3c041fc41e109d01 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: "VCR pour Playwright — enregistrez et rejouez les réponses d'API | test-proxy-recorder",
    description:
      "Enregistrement et rejeu façon VCR pour Playwright. Capturez une fois les vraies réponses d'API, rejouez-les de façon déterministe en CI — sans backend, sans mocks écrits à la main. Proxy SSR + HAR navigateur, WebSockets. Gratuit et MIT.",
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
  },

  hero: {
    eyebrow: 'VCR pour Playwright',
    headlineTop: 'Enregistrez une fois.',
    headlineBottom: 'Rejouez pour toujours.',
    sub: "Capture les vraies réponses d'API pendant que votre suite Playwright s'exécute en local, puis les rejoue octet par octet en CI. Sans backend, sans réseau, sans mocks écrits à la main à maintenir.",
    copyLabel: 'Copier',
    starCta: 'Mettre une étoile sur GitHub',
    starCountAlt: "Nombre d'étoiles GitHub",
    fine: 'MIT · TypeScript · fonctionne avec le SSR Next.js & TanStack Start, les SPA et les extensions Chrome · prise en charge WebSocket',
  },

  demo: {
    heading: 'Voyez-le enregistrer, puis rejouer',
    sub: 'Une exécution Playwright enregistre de vraies réponses sur le disque ; basculez en rejeu et la même suite passe avec le backend éteint — sans réseau.',
    videoLabel:
      "Enregistrement d'écran : enregistrement des vraies réponses d'API avec test-proxy-recorder, puis rejeu avec le backend éteint.",
  },

  mechanisms: {
    heading: 'Deux enregistreurs, un proxy',
    sub: "Les requêtes ont leur origine à deux endroits, donc il y a deux mécanismes d'enregistrement. Utilisez l'un ou l'autre — ou les deux ensemble. Les deux enregistrent une fois et rejouent depuis le disque, donc la CI tourne avec le backend éteint et sans mocks écrits à la main.",
    proxy: {
      title: 'Proxy',
      flow: 'SSR Next.js / TanStack Start → proxy → vraie API',
      body: "Se place entre votre serveur et l'API. Enregistre les requêtes côté serveur — fetches SSR, route handlers, tout ce que votre backend-for-frontend appelle.",
      when: "Pour les apps full-stack où le serveur appelle l'API.",
      exampleNextjs: "Voir l'exemple Next.js →",
      exampleTanstack: "Voir l'exemple TanStack Start →",
    },
    har: {
      title: 'HAR',
      flow: 'navigateur → interception HAR → vraie API',
      bodyStart: 'Intercepte dans le navigateur lui-même. Enregistre les appels',
      bodyEnd: "côté client, le trafic des API d'extensions Chrome, l'analytics, les API tierces.",
      when: 'Pour les SPA, les extensions et les apps uniquement navigateur.',
      exampleExtension: "Voir l'exemple d'extension Chrome →",
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
      "Polly.js intercepte le HTTP de Node, donc le mock SSR est possible dans le processus de l'app, mais pas dans le cadre d'une exécution Playwright. MSW et Mocky Balboa rejouent aussi de vraies réponses — mais vous écrivez les mocks à la main. Quand choisir autre chose est couvert dans les",
    footLinkLabel: 'docs',
    footEnd: '.',
  },

  auth: {
    heading: "Fonctionne avec votre vrai fournisseur d'authentification",
    sub: "Connectez-vous via Cognito, Auth0, Clerk ou WorkOS — pour de vrai, à chaque exécution. Seule l'API de votre app est enregistrée ; l'authentification reste en direct, vos données passent hors ligne.",
    links: {
      cognito: 'Exemple AWS Cognito →',
      tanstack: 'Cognito sur TanStack Start →',
      mock: 'Authentification mock (sans compte cloud) →',
    },
  },

  quickStart: {
    heading: 'Configuration en trois étapes',
    subStart:
      'Scaffoldez tout avec une commande, pointez votre API vers le proxy, puis enregistrez et committez. App uniquement navigateur ?',
    subEnd: "saute l'étape SSR pour vous.",
    ai: {
      heading: 'Chemin le plus rapide : confiez-le à votre agent IA',
      noteStart:
        "Copiez ceci, remplacez votre URL de backend et collez-le dans Claude Code, Cursor ou n'importe quel agent de codage — il exécute",
      noteMid: 'et termine le branchement à partir du prompt',
      noteEnd: 'affiche.',
      copyLabel: 'Copier',
    },
    manualIntro: 'Ou branchez-le à la main :',
    steps: {
      install: {
        title: 'Installer et scaffolder',
        noteStart: 'écrit la config du proxy, une fixture Playwright, un teardown global, des scripts',
        noteEnd:
          ', et (sur Next.js) branche le marquage des fetches SSR dans votre root layout — sans rien écraser.',
      },
      apiEnv: {
        title: "Pointez l'API de votre app vers le proxy",
        noteStart: 'La seule chose',
        noteEnd:
          "ne peut pas deviner : quelle variable d'environnement contient l'URL de base de votre API. Pointez-la vers le proxy lorsque le recorder est activé, vers le vrai backend sinon — le proxy ne tourne jamais en production.",
        ssrStart: 'Sur Next.js,',
        ssrAfterInit: 'ajoute aussi',
        ssrAfterFn: 'à votre root layout pour tagger les',
        ssrEnd: 'côté serveur — un no-op en production :',
      },
      record: {
        title: 'Enregistrer, committer, rejouer',
        noteStart: 'Définissez',
        noteMid: ', exécutez une fois contre la vraie API, puis basculez sur',
        noteEnd:
          "et committez. Les enregistrements vivent dans git — c'est ce qui rend la CI déterministe. Ne les gitignorez pas.",
      },
    },
  },

  cta: {
    heading: "Arrêtez d'écrire des mocks à la main",
    sub: 'Votre API donne déjà les bonnes réponses. Enregistrez-les.',
    copyLabel: 'Copier',
    starCta: 'Mettre une étoile sur GitHub',
    fineStart:
      "Si ça vous a épargné un après-midi, une étoile prend une seconde — c'est ainsi que la prochaine personne le trouve, et cela dit à un mainteneur solo de continuer à construire. Vous avez un souci ou une idée ?",
    issueLabel: 'Ouvrir une issue',
    fineBetween: 'ou',
    discordLabel: 'rejoindre Discord',
    fineEnd: '.',
  },
};
