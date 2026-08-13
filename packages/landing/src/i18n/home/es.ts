// Spanish (es) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=es source=en.ts source-blob=0e5944e1211d8ba9dcc934fd3c041fc41e109d01 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'VCR para Playwright — graba, reproduce | test-proxy-recorder',
    description:
      'Grabar y reproducir estilo VCR para Playwright. Captura respuestas reales una vez y reprodúcelas en CI — sin backend ni mocks. Proxy SSR + HAR, WebSockets. MIT.',
    ogImageAlt:
      'test-proxy-recorder — record once, replay forever. Diagrama de los modos de grabación y reproducción.',
  },

  chrome: {
    skipToContent: 'Saltar al contenido',
    navQuickStart: 'Inicio rápido',
    navDocs: 'Documentación',
    updated: 'Actualizado',
    licensed: 'Con licencia MIT.',
    languageLabel: 'Idioma',
  },

  hero: {
    eyebrow: 'VCR para Playwright',
    headlineTop: 'Graba una vez.',
    headlineBottom: 'Reproduce para siempre.',
    sub: 'Captura respuestas reales de la API mientras tu suite de Playwright se ejecuta localmente, y luego las reproduce byte a byte en CI. Sin backend, sin red, sin mocks escritos a mano que mantener.',
    copyLabel: 'Copiar',
    starCta: 'Dar estrella en GitHub',
    starCountAlt: 'Recuento de estrellas de GitHub',
    fine: 'MIT · TypeScript · funciona con SSR de Next.js y TanStack Start, SPAs y extensiones de Chrome · soporte de WebSocket',
  },

  demo: {
    heading: 'Míralo grabar y luego reproducir',
    sub: 'Una ejecución de Playwright graba respuestas reales en disco; cambia a reproducir y la misma suite pasa con el backend apagado — sin red.',
    videoLabel:
      'Grabación de pantalla: grabando respuestas reales de la API con test-proxy-recorder y luego reproduciéndolas con el backend apagado.',
  },

  mechanisms: {
    heading: 'Dos grabadores, un proxy',
    sub: 'Las peticiones se originan en dos lugares, así que hay dos mecanismos de grabación. Usa uno u otro — o ambos a la vez. Ambos graban una vez y reproducen desde el disco, así que CI se ejecuta con el backend apagado y sin mocks escritos a mano.',
    proxy: {
      title: 'Proxy',
      flow: 'SSR de Next.js / TanStack Start → proxy → API real',
      body: 'Se sitúa entre tu servidor y la API. Graba las peticiones del lado del servidor — fetch SSR, route handlers, cualquier cosa que llame tu backend-for-frontend.',
      when: 'Para apps full-stack donde el servidor llama a la API.',
      exampleNextjs: 'Ver el ejemplo de Next.js →',
      exampleTanstack: 'Ver el ejemplo de TanStack Start →',
    },
    har: {
      title: 'HAR',
      flow: 'navegador → interceptación HAR → API real',
      bodyStart: 'Intercepta en el propio navegador. Graba las llamadas',
      bodyEnd:
        'del lado del cliente, el tráfico de API de extensiones de Chrome, la analítica y las APIs de terceros.',
      when: 'Para SPAs, extensiones y apps solo de navegador.',
      exampleExtension: 'Ver el ejemplo de extensión de Chrome →',
    },
  },

  compare: {
    heading: 'Dónde encaja',
    sub: 'Las herramientas de mocking son buenas para trabajos distintos. La combinación de abajo — grabar tráfico real a través de SSR, navegador y WebSockets, sin mocks escritos a mano — es el hueco que las demás dejan abierto.',
    tableCaption:
      'Comparación de características de test-proxy-recorder frente a routeFromHAR de Playwright, MSW, Polly.js, playwright-network-cache y Mocky Balboa.',
    featureLabel: 'Característica',
    features: [
      'Graba tráfico real',
      'Lado del servidor (SSR)',
      'Lado del navegador',
      'WebSocket',
      'Nativo de Playwright',
      'Mantenido',
    ],
    markText: { y: 'Sí', n: 'No', p: 'Parcial' },
    footStart:
      'Polly.js intercepta el HTTP de Node, así que el mocking de SSR es posible dentro del proceso de la app, pero no como parte de una ejecución de Playwright. MSW y Mocky Balboa también reproducen respuestas reales — pero escribes los mocks a mano. Cuándo recurrir a otra cosa se explica en la',
    footLinkLabel: 'documentación',
    footEnd: '.',
  },

  auth: {
    heading: 'Funciona con tu proveedor de auth real',
    sub: 'Inicia sesión a través de Cognito, Auth0, Clerk o WorkOS — de verdad, en cada ejecución. Solo se graba la API de tu app; la auth se mantiene en vivo y tus datos quedan sin conexión.',
    links: {
      cognito: 'Ejemplo de AWS Cognito →',
      tanstack: 'Cognito en TanStack Start →',
      mock: 'Auth simulada (sin cuenta en la nube) →',
    },
  },

  quickStart: {
    heading: 'Configúralo en tres pasos',
    subStart:
      'Genera todo el andamiaje con un solo comando, apunta tu API al proxy, luego graba y haz commit. ¿App solo de navegador?',
    subEnd: 'se salta el paso de SSR por ti.',
    ai: {
      heading: 'Vía más rápida: dáselo a tu agente de IA',
      noteStart:
        'Copia esto, cambia la URL de tu backend y pégalo en Claude Code, Cursor o cualquier agente de codificación — ejecuta',
      noteMid: 'y termina el cableado a partir del prompt que',
      noteEnd: 'imprime.',
      copyLabel: 'Copiar',
    },
    manualIntro: 'O cablea a mano:',
    steps: {
      install: {
        title: 'Instala y genera el andamiaje',
        noteStart:
          'escribe la config del proxy, un fixture de Playwright, un teardown global y los scripts de',
        noteEnd:
          'y, en Next.js, cablea el etiquetado de los fetch SSR en tu root layout — de forma no destructiva.',
      },
      apiEnv: {
        title: 'Apunta la API de tu app al proxy',
        noteStart: 'Lo único que',
        noteEnd:
          'no puede adivinar: qué variable de entorno guarda la URL base de tu API. Apúntala al proxy cuando el grabador está activo, y al backend real en caso contrario — el proxy nunca se ejecuta en producción.',
        ssrStart: 'En Next.js,',
        ssrAfterInit: 'también añade',
        ssrAfterFn: 'a tu root layout para etiquetar las llamadas del lado del servidor',
        ssrEnd: '— un no-op en producción:',
      },
      record: {
        title: 'Graba, haz commit, reproduce',
        noteStart: 'Establece',
        noteMid: ', ejecuta una vez contra la API real, luego cambia a',
        noteEnd:
          'y haz commit. Las grabaciones viven en git — eso es lo que hace a CI determinista. No las pongas en .gitignore.',
      },
    },
  },

  cta: {
    heading: 'Deja de escribir mocks a mano',
    sub: 'Tu API ya da las respuestas correctas. Grábalas.',
    copyLabel: 'Copiar',
    starCta: 'Dar estrella en GitHub',
    fineStart:
      'Si te ahorró una tarde, una estrella cuesta un segundo — así es como la encuentra la siguiente persona, y le dice a un mantenedor en solitario que siga construyendo. ¿Topaste con un problema o tienes una idea?',
    issueLabel: 'Abre un issue',
    fineBetween: 'o',
    discordLabel: 'únete a Discord',
    fineEnd: '.',
  },
};
