// Spanish (es) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=es source=en.ts source-blob=c698d86206f541e55eef9064035f21550ca9a188 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'Graba y reproduce llamadas a la API en Playwright, con SSR',
    description:
      'Graba respuestas reales de la API en Playwright y reprodúcelas en CI. Cubre fetch del servidor en Next.js y TanStack Start, llamadas del navegador y WebSockets.',
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
    copied: 'Copiado',
  },

  hero: {
    title: 'Graba y reproduce llamadas a la API en pruebas de Playwright, incluidas las peticiones del lado del servidor',
    headlineTop: 'Graba una vez.',
    headlineBottom: 'Reproduce para siempre.',
    sub: 'Graba las respuestas de la API que recibe tu app durante una ejecución local de Playwright, WebSockets incluidos, y luego las reproduce en CI con tu backend apagado.',
    copyLabel: 'Copiar',
    starCta: 'Dar estrella en GitHub',
    fine: 'MIT · TypeScript · Node ≥ 20 · SSR de Next.js y TanStack Start, SPAs, extensiones de Chrome, WebSockets',
    scenePause: 'Pausar',
    scenePlay: 'Reproducir',
  },

  demo: {
    heading: 'Míralo grabar y luego reproducir',
    sub: 'Una ejecución de Playwright graba respuestas reales en disco; cambia a reproducir y la misma suite pasa con el backend apagado.',
    videoLabel:
      'Grabación de pantalla: grabando respuestas reales de la API con test-proxy-recorder y luego reproduciéndolas con el backend apagado.',
  },

  mechanisms: {
    heading: 'Dos formas de grabar',
    sub: 'Las peticiones se originan en dos lugares, así que hay dos formas de grabarlas, y el proceso del proxy se ejecuta en ambas. Todo lo que se envía al proxy (fetch del lado del servidor, llamadas del navegador a través de una URL base de la API compartida con el servidor, WebSockets) se reproduce desde el .mock.json de la prueba. Las llamadas del navegador a otros hosts que coinciden con el patrón url de tu fixture se reproducen desde el .har de la prueba.',
    proxy: {
      title: 'Proxy',
      flow: 'SSR de Next.js / TanStack Start → proxy → API real',
      body: 'Se sitúa entre tu servidor y la API. Graba las peticiones del lado del servidor: los fetch de Server Components y de SSR, los route handlers y cualquier cosa que llame tu backend-for-frontend.',
      when: 'Para apps full-stack donde el servidor llama a la API.',
      parallel: 'Las peticiones del lado del servidor de cada prueba llevan el id de esa prueba, así que las pruebas que se ejecutan en paralelo nunca comparten una grabación.',
      guideNextjs: 'Guía de Next.js\u00a0→',
      guideTanstack: 'Guía de TanStack Start\u00a0→',
      exampleNextjs: 'Ver el ejemplo de Next.js\u00a0→',
      exampleTanstack: 'Ver el ejemplo de TanStack Start\u00a0→',
    },
    har: {
      title: 'HAR',
      flow: 'navegador → interceptación HAR → API real',
      bodyStart: 'Intercepta en el propio navegador y guarda un archivo HTTP Archive (HAR). Graba las llamadas',
      bodyEnd:
        'del lado del cliente, el tráfico de API de extensiones de Chrome, la analítica y las APIs de terceros, siempre que coincidan con el patrón url de tu fixture.',
      when: 'Para SPAs, extensiones y apps solo de navegador.',
      proxyNote:
        'Frente a routeFromHAR a secas, añade un HAR por prueba y enmascara las cabeceras de autenticación.',
      guidePlaywright: 'Guía de Playwright\u00a0→',
      exampleExtension: 'Ver el ejemplo de extensión de Chrome\u00a0→',
      exampleVite: 'Ver el ejemplo de Vite + WebSocket\u00a0→',
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
      'Polly.js graba dentro del proceso en el que se ejecuta, así que, para las peticiones del lado del servidor, tiene que ejecutarse dentro del servidor de tu app. MSW y Mocky Balboa también hacen mocking de las peticiones del lado del servidor, pero las respuestas las escribes tú. La comparación completa, con fuentes y cuándo elegir otra herramienta, está en la',
    footLinkLabel: 'documentación',
    footEnd: '.',
    tradeoff:
      'La contrapartida es una primera configuración más laboriosa que con las herramientas solo de navegador: un proceso de proxy se ejecuta junto a tus pruebas y, para las peticiones del lado del servidor, la URL base de la API de tu app apunta a él durante las ejecuciones de prueba.',
  },

  auth: {
    heading: 'Funciona con tu proveedor de auth real',
    sub: 'Inicia sesión a través de Cognito, Auth0, Clerk o WorkOS — de verdad, en cada ejecución. Solo se graba la API de tu app; la auth se mantiene en vivo y tus datos quedan sin conexión.',
    links: {
      cognito: 'Ejemplo de AWS Cognito\u00a0→',
      tanstack: 'Cognito en TanStack Start\u00a0→',
      mock: 'Auth simulada (sin cuenta en la nube)\u00a0→',
    },
  },

  recordingSample: {
    heading: 'Cómo es una grabación',
    perTest: {
      term: 'Un archivo por prueba',
      start: 'Cada prueba escribe su propio archivo, con el nombre de la prueba, así que',
      end: 'vuelve a grabar solo esa prueba. El proxy graba una prueba cada vez, así que graba con un solo worker; la reproducción se ejecuta en paralelo.',
    },
    testId: {
      term: 'El id de la prueba',
      start: 'Playwright envía',
      mid: 'con cada petición que hace una prueba, y',
      end: 'lo copia en los fetch propios de tu servidor. El proxy lo lee para responder a cada prueba desde el archivo de esa misma prueba, incluso cuando las pruebas se reproducen en paralelo.',
    },
    secrets: {
      term: 'Secretos',
      body: 'Las cabeceras Authorization, Cookie y Set-Cookie pasan a ser [REDACTED] en los archivos .mock.json antes de escribirse, y en los archivos .har cuando termina la ejecución. Para los secretos dentro de los cuerpos de respuesta necesitas patrones propios.',
      link: 'Enmascaramiento de secretos\u00a0→',
    },
    caption:
      'Parte de una grabación real, de 2.6 KB en total: el POST de una prueba, con su cabecera Authorization enmascarada. El archivo completo también contiene el GET que vino después, todas las cabeceras y una marca de tiempo para cada petición.',
  },

  replayQuestions: {
    heading: 'Preguntas sobre la reproducción',
    matching: {
      term: '¿Cómo se emparejan las peticiones?',
      body: 'El proxy empareja una llamada del lado del servidor por su método, su ruta y su cadena de consulta (query string) exacta, no por su cuerpo, y sirve las llamadas repetidas en el orden en que se grabaron. Las llamadas del navegador siguen las reglas de HAR de Playwright, que también comparan los cuerpos de los POST. Una cadena de consulta que cambia en cada ejecución, como una marca de tiempo, nunca coincide, y no hay ninguna opción para ignorar un parámetro, así que mantén esos valores fijos durante las pruebas.',
      link: 'Cómo se emparejan las peticiones al reproducir\u00a0→',
    },
    misses: {
      term: '¿Y si falta una grabación?',
      start:
        'El proxy responde con un 404 que indica la petición y la prueba. Una llamada que se hace más veces de las que se grabó recibe de nuevo la última respuesta, con un aviso en el log del proxy. En el navegador, Playwright aborta una llamada que coincide con el patrón',
      mid: 'que tu fixture pasa a',
      end: 'pero que no está en el HAR; las demás llamadas llegan a la red.',
    },
    liveApi: {
      term: '¿Cuándo llega la reproducción a la API real?',
      start:
        'La reproducción solo llega a la API real cuando el proxy sale del modo replay, y el proxy mantiene un único modo para todas las pruebas en curso. Sale del modo replay 120 segundos después del inicio de la última prueba, o cuando un hook por prueba llama a',
      end: '. Sin un backend en ejecución en CI, una petición que llegue a la API real falla en lugar de pasar.',
      link: 'Timeout de sesión y teardown\u00a0→',
    },
    drift: {
      term: '¿Qué pasa cuando cambia la API?',
      body: 'Con un cliente de API tipado, actualizar el cliente por un campo que ha cambiado hace fallar las pruebas reproducidas que lo usan, porque las grabaciones aún contienen el campo antiguo. Eso te señala el cambio, y volver a grabar arregla las pruebas con menos trabajo que editar mocks escritos a mano.',
    },
    overrides: {
      term: '¿Cómo pruebo errores y casos límite?',
      start: 'En el navegador, un',
      mid: 'registrado después de',
      end: 'tiene prioridad sobre la grabación. Las respuestas del lado del servidor se editan en el archivo .mock.json.',
      link: 'Forzar una respuesta\u00a0→',
    },
  },

  quickStart: {
    heading: 'Inicio rápido',
    subStart:
      'Genera todo el andamiaje con un solo comando, apunta tu API al proxy, luego graba y haz commit. ¿App solo de navegador?',
    subEnd: 'se salta el paso de SSR por ti.',
    tabs: {
      agent: 'Con tu agente de IA',
      manual: 'A mano',
    },
    ai: {
      noteStart:
        'Pega esto en Claude Code, Cursor u otro agente de codificación. Primero ejecuta @tanstack/intent, que añade una guía al archivo de configuración de tu agente, como CLAUDE.md, para que el agente cargue las skills de configuración de esta librería. Después instala el paquete, busca la URL de tu backend en la configuración de la app, ejecuta',
      noteEnd: 'y termina el cableado a partir de su salida.',
      copyLabel: 'Copiar prompt',
    },
    changes: {
      label: 'Qué cambia en tu repo',
      tests:
        'En tu suite de pruebas: un fixture de Playwright, el proceso del proxy (solo se ejecuta durante las pruebas) y las grabaciones, versionadas en git.',
      appStart:
        'En tu app, solo para las peticiones del lado del servidor: apunta la URL base de la API al proxy durante las ejecuciones de prueba y llama a',
      appEnd:
        'una vez, en app/layout.tsx en Next.js o en src/router.tsx en TanStack Start. Copia el id de la prueba en cada fetch del lado del servidor y no hace nada en producción salvo que TEST_PROXY_RECORDER_ENABLED esté definida.',
      agent:
        'Con el prompt para el agente: @tanstack/intent añade al archivo de configuración de tu agente, como CLAUDE.md, una guía para cargar las skills de esta librería.',
      deployed:
        '¿Pruebas un entorno desplegado? HAR graba sus llamadas del navegador sin cambios en la app, pero las páginas en sí siguen cargándose desde ese servidor. Para reproducir también las llamadas del lado del servidor, ejecuta la app en CI junto al proxy.',
    },
    steps: {
      install: {
        title: 'Instala y genera el andamiaje',
        noteStart:
          'escribe la config del proxy, un fixture de Playwright, un teardown global y los scripts de',
        noteEnd:
          'y, en Next.js, cablea el etiquetado de los fetch SSR en tu root layout — de forma no destructiva.',
      },
      apiEnv: {
        title: 'Apunta al proxy las llamadas a la API del lado del servidor',
        noteStart: 'Lo único que',
        noteEnd:
          'no puede adivinar: qué variable de entorno guarda la URL base de tu API. Apúntala al proxy cuando el grabador está activo, y al backend real en caso contrario — el proxy nunca se ejecuta en producción.',
        ssrStart: 'En Next.js,',
        ssrAfterInit: 'también añade',
        ssrAfterFn: 'a tu root layout para etiquetar las llamadas',
        ssrEnd: 'del lado del servidor — un no-op en producción.',
        browserOnly:
          '¿App solo de navegador? Sáltate este paso salvo que la app abra WebSockets, que solo se graban cuando se conectan a la dirección del proxy.',
      },
      record: {
        title: 'Graba, haz commit, reproduce',
        noteStart: 'Establece',
        noteMid: ', ejecuta una vez contra la API real, luego cambia a',
        noteEnd:
          'y haz commit. Las grabaciones viven en git — eso es lo que hace a CI determinista. No las pongas en .gitignore.',
      },
    },
    guideLink: 'Guía de configuración completa\u00a0→',
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
