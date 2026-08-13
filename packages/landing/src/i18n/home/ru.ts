// Russian (ru) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=ru source=en.ts source-blob=0e5944e1211d8ba9dcc934fd3c041fc41e109d01 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'VCR для Playwright — запись и воспроизведение ответов API | test-proxy-recorder',
    description:
      'Запись и воспроизведение в стиле VCR для Playwright. Захватите реальные ответы API один раз и детерминированно воспроизводите их в CI — без бэкенда и моков, написанных вручную. SSR-прокси + браузерный HAR, WebSocket. Бесплатно и MIT.',
    ogImageAlt:
      'test-proxy-recorder — записать один раз, воспроизводить вечно. Схема режимов записи и воспроизведения.',
  },

  chrome: {
    skipToContent: 'Перейти к содержимому',
    navQuickStart: 'Быстрый старт',
    navDocs: 'Документация',
    updated: 'Обновлено',
    licensed: 'Лицензия MIT.',
    languageLabel: 'Язык',
  },

  hero: {
    eyebrow: 'VCR для Playwright',
    headlineTop: 'Записать один раз.',
    headlineBottom: 'Воспроизводить вечно.',
    sub: 'Захватывает реальные ответы API, пока ваш набор Playwright выполняется локально, а затем воспроизводит их байт-в-байт в CI. Без бэкенда, без сети и без моков, написанных вручную, которые нужно поддерживать.',
    copyLabel: 'Копировать',
    starCta: 'Поставить звезду на GitHub',
    starCountAlt: 'Количество звёзд на GitHub',
    fine: 'MIT · TypeScript · работает с SSR Next.js и TanStack Start, SPA и расширениями Chrome · поддержка WebSocket',
  },

  demo: {
    heading: 'Посмотрите, как он записывает, а затем воспроизводит',
    sub: 'Один прогон Playwright записывает реальные ответы на диск; переключитесь на воспроизведение — и тот же набор тестов пройдёт с выключенным бэкендом, без сети.',
    videoLabel:
      'Запись экрана: запись реальных ответов API с test-proxy-recorder, а затем их воспроизведение с выключенным бэкендом.',
  },

  mechanisms: {
    heading: 'Два записывающих механизма, один прокси',
    sub: 'Запросы исходят из двух мест, поэтому есть два механизма записи. Используйте любой — или оба вместе. Оба записывают один раз и воспроизводят с диска, поэтому CI работает с выключенным бэкендом и без моков, написанных вручную.',
    proxy: {
      title: 'Прокси',
      flow: 'Next.js / TanStack Start SSR → прокси → реальный API',
      body: 'Находится между вашим сервером и API. Записывает серверные запросы — SSR-fetch, route handlers и всё, что вызывает ваш backend-for-frontend.',
      when: 'Для full-stack-приложений, где сервер вызывает API.',
      exampleNextjs: 'Смотреть пример Next.js →',
      exampleTanstack: 'Смотреть пример TanStack Start →',
    },
    har: {
      title: 'HAR',
      flow: 'браузер → перехват HAR → реальный API',
      bodyStart: 'Перехватывает в самом браузере. Записывает клиентские',
      bodyEnd: 'вызовы, трафик API расширений Chrome, аналитику и сторонние API.',
      when: 'Для SPA, расширений и приложений только для браузера.',
      exampleExtension: 'Смотреть пример расширения Chrome →',
    },
  },

  compare: {
    heading: 'Где он уместен',
    sub: 'Инструменты для моков хороши в разных задачах. Приведённая ниже комбинация — запись реального трафика через SSR, браузер и WebSocket без моков, написанных вручную, — это ниша, которую остальные оставляют незакрытой.',
    tableCaption:
      'Сравнение возможностей test-proxy-recorder с routeFromHAR в Playwright, MSW, Polly.js, playwright-network-cache и Mocky Balboa.',
    featureLabel: 'Возможность',
    features: [
      'Запись реального трафика',
      'Серверная сторона (SSR)',
      'Сторона браузера',
      'WebSocket',
      'Нативно для Playwright',
      'Поддерживается',
    ],
    markText: { y: 'Да', n: 'Нет', p: 'Частично' },
    footStart:
      'Polly.js перехватывает HTTP в Node, поэтому мокинг SSR возможен внутри процесса приложения, но не как часть прогона Playwright. MSW и Mocky Balboa тоже воспроизводят реальные ответы — но моки вы пишете вручную. О том, когда стоит выбрать что-то другое, рассказано в',
    footLinkLabel: 'документации',
    footEnd: '.',
  },

  auth: {
    heading: 'Работает с вашим реальным провайдером аутентификации',
    sub: 'Входите через Cognito, Auth0, Clerk или WorkOS — по-настоящему, при каждом прогоне. Записывается только API вашего приложения; аутентификация остаётся живой, ваши данные уходят офлайн.',
    links: {
      cognito: 'Пример AWS Cognito →',
      tanstack: 'Cognito на TanStack Start →',
      mock: 'Мок-аутентификация (без облачного аккаунта) →',
    },
  },

  quickStart: {
    heading: 'Настройка за три шага',
    subStart:
      'Разверните всё одной командой, направьте ваш API на прокси, затем запишите и закоммитьте. Приложение только для браузера?',
    subEnd: 'пропустит шаг SSR за вас.',
    ai: {
      heading: 'Самый быстрый путь: отдайте это вашему AI-агенту',
      noteStart:
        'Скопируйте это, подставьте URL вашего бэкенда и вставьте в Claude Code, Cursor или любого кодинг-агента — он запустит',
      noteMid: 'и доделает проводку по подсказке, которую',
      noteEnd: 'печатает.',
      copyLabel: 'Копировать',
    },
    manualIntro: 'Или подключите вручную:',
    steps: {
      install: {
        title: 'Установка и разворачивание',
        noteStart: 'записывает конфиг прокси, фикстуру Playwright, глобальный тередаун,',
        noteEnd:
          'скрипты и (для Next.js) тегирование SSR-fetch в вашем root layout — неразрушающе.',
      },
      apiEnv: {
        title: 'Направьте API вашего приложения на прокси',
        noteStart: 'Единственное, что',
        noteEnd:
          'не может угадать: какая переменная окружения хранит базовый URL вашего API. Направьте её на прокси, когда рекордер включён, на реальный бэкенд в остальных случаях — прокси никогда не запускается в продакшене.',
        ssrStart: 'Для Next.js',
        ssrAfterInit: 'также добавляет',
        ssrAfterFn: 'в ваш root layout, чтобы тегировать серверные',
        ssrEnd: 'вызовы — no-op в продакшене:',
      },
      record: {
        title: 'Запись, коммит, воспроизведение',
        noteStart: 'Задайте',
        noteMid: ', запустите один раз против реального API, затем переключите на',
        noteEnd:
          'и закоммитьте. Записи живут в git — именно это делает CI детерминированным. Не добавляйте их в .gitignore.',
      },
    },
  },

  cta: {
    heading: 'Хватит писать моки вручную',
    sub: 'Ваш API уже даёт правильные ответы. Запишите их.',
    copyLabel: 'Копировать',
    starCta: 'Поставить звезду на GitHub',
    fineStart:
      'Если это сэкономило вам полдня, звезда займёт одну секунду — именно так следующий человек найдёт проект, а соло-мейнтейнер поймёт, что нужно продолжать. Наткнулись на проблему или есть идея?',
    issueLabel: 'Создайте issue',
    fineBetween: 'или',
    discordLabel: 'присоединяйтесь к Discord',
    fineEnd: '.',
  },
};
