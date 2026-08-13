// Korean (ko) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=ko source=en.ts source-blob=0e5944e1211d8ba9dcc934fd3c041fc41e109d01 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'Playwright용 VCR — API 응답 기록 및 재생 | test-proxy-recorder',
    description:
      'VCR 방식의 Playwright 기록 및 재생 도구. 실제 API 응답을 한 번만 캡처하고 CI에서 결정적으로 재생합니다. 백엔드 없이, 직접 작성한 목(mock) 없이 동작합니다. SSR 프록시 + 브라우저 HAR, WebSocket을 지원합니다. 무료 · MIT 라이선스.',
    ogImageAlt:
      'test-proxy-recorder — 한 번 기록하고 영원히 재생합니다. 기록 모드와 재생 모드의 다이어그램.',
  },

  chrome: {
    skipToContent: '본문으로 건너뛰기',
    navQuickStart: '빠른 시작',
    navDocs: '문서',
    updated: '업데이트',
    licensed: 'MIT 라이선스.',
    languageLabel: '언어',
  },

  hero: {
    eyebrow: 'Playwright용 VCR',
    headlineTop: '한 번 기록하세요.',
    headlineBottom: '영원히 재생하세요.',
    sub: 'Playwright 스위트를 로컬에서 실행하는 동안 실제 API 응답을 캡처한 다음, CI에서 바이트 단위 그대로 재생합니다. 백엔드도, 네트워크도, 유지 관리할 직접 작성한 목(mock)도 없습니다.',
    copyLabel: '복사',
    starCta: 'GitHub에서 스타',
    starCountAlt: 'GitHub 스타 수',
    fine: 'MIT · TypeScript · Next.js 및 TanStack Start SSR, SPA, Chrome 확장 프로그램과 호환 · WebSocket 지원',
  },

  demo: {
    heading: '기록하고 재생하는 모습을 확인하세요',
    sub: '한 번의 Playwright 실행으로 실제 응답을 디스크에 기록합니다. 재생으로 전환하면 동일한 스위트가 백엔드를 끈 상태로 통과합니다. 네트워크 없이요.',
    videoLabel:
      '화면 녹화: test-proxy-recorder로 실제 API 응답을 기록한 다음, 백엔드를 끈 상태로 재생하는 모습.',
  },

  mechanisms: {
    heading: '두 개의 레코더, 하나의 프록시',
    sub: '요청은 두 곳에서 발생하므로 기록 메커니즘도 두 가지입니다. 둘 중 하나를 사용하거나 함께 사용하세요. 둘 다 한 번 기록하고 디스크에서 재생하므로, CI가 백엔드를 끈 상태로, 직접 작성한 목(mock) 없이 실행됩니다.',
    proxy: {
      title: '프록시',
      flow: 'Next.js / TanStack Start SSR → 프록시 → 실제 API',
      body: '서버와 API 사이에 위치합니다. 서버 측 요청(SSR fetch, 라우트 핸들러, BFF(backend-for-frontend)가 호출하는 모든 것)을 기록합니다.',
      when: '서버가 API를 호출하는 풀스택 앱용.',
      exampleNextjs: 'Next.js 예제 보기 →',
      exampleTanstack: 'TanStack Start 예제 보기 →',
    },
    har: {
      title: 'HAR',
      flow: '브라우저 → HAR 가로채기 → 실제 API',
      bodyStart: '브라우저 자체에서 가로챕니다. 클라이언트 측',
      bodyEnd: '호출, Chrome 확장 프로그램 API 트래픽, 분석, 서드파티 API를 기록합니다.',
      when: 'SPA, 확장 프로그램, 브라우저 전용 앱용.',
      exampleExtension: 'Chrome 확장 프로그램 예제 보기 →',
    },
  },

  compare: {
    heading: '어디에 적합한가',
    sub: '목킹 도구들은 각자 다른 작업에 뛰어납니다. 아래 조합(직접 작성한 목(mock) 없이 SSR, 브라우저, WebSocket 전반에서 실제 트래픽을 기록)이 다른 도구들이 남겨 둔 공백입니다.',
    tableCaption:
      'test-proxy-recorder와 Playwright routeFromHAR, MSW, Polly.js, playwright-network-cache, Mocky Balboa의 기능 비교.',
    featureLabel: '기능',
    features: [
      '실제 트래픽 기록',
      '서버 측(SSR)',
      '브라우저 측',
      'WebSocket',
      'Playwright 네이티브',
      '유지 관리됨',
    ],
    markText: { y: '예', n: '아니요', p: '부분' },
    footStart:
      'Polly.js는 Node HTTP를 가로채므로 앱 프로세스 내부에서 SSR 모킹이 가능하지만, Playwright 실행의 일부로는 불가능합니다. MSW와 Mocky Balboa도 실제 응답을 재생하지만, 직접 목(mock)을 작성해야 합니다. 다른 도구를 선택해야 하는 경우는 ',
    footLinkLabel: '문서',
    footEnd: '에서 다룹니다.',
  },

  auth: {
    heading: '실제 인증 공급자와 함께 동작',
    sub: "Cognito, Auth0, Clerk 또는 WorkOS를 통해 실제로, 매 실행마다 로그인하세요. 앱의 API만 기록되며, 인증은 계속 실시간으로 동작하고 데이터는 오프라인으로 재생됩니다.",
    links: {
      cognito: 'AWS Cognito 예제 →',
      tanstack: 'TanStack Start의 Cognito →',
      mock: '목(mock) 인증(클라우드 계정 불필요) →',
    },
  },

  quickStart: {
    heading: '세 단계로 설정하기',
    subStart:
      '한 번의 명령으로 모든 것을 스캐폴딩하고, API를 프록시로 연결한 뒤 기록하고 커밋하세요. 브라우저 전용 앱인가요?',
    subEnd: '이 SSR 단계를 대신 건너뜁니다.',
    ai: {
      heading: '가장 빠른 방법: AI 에이전트에게 맡기기',
      noteStart:
        '이것을 복사하고 백엔드 URL을 바꾼 뒤 Claude Code, Cursor 또는 아무 코딩 에이전트에 붙여넣으세요. 그러면 ',
      noteMid: '을 실행하고, ',
      noteEnd: '이 출력하는 프롬프트에 따라 나머지 연결 작업을 마무리합니다.',
      copyLabel: '복사',
    },
    manualIntro: '또는 직접 연결하기:',
    steps: {
      install: {
        title: '설치 및 스캐폴딩',
        noteStart: '은 프록시 설정, Playwright 픽스처, 전역 티어다운, ',
        noteEnd:
          ' 스크립트를 작성하고, (Next.js의 경우) SSR fetch 태깅을 루트 레이아웃에 연결합니다. 비파괴적으로 동작합니다.',
      },
      apiEnv: {
        title: '앱의 API를 프록시로 연결',
        noteStart: '',
        noteEnd:
          '이 추측할 수 없는 유일한 것은 바로 API 기본 URL을 담고 있는 환경 변수입니다. 레코더가 활성화되어 있으면 프록시를, 그렇지 않으면 실제 백엔드를 가리키세요. 프록시는 프로덕션에서 절대 실행되지 않습니다.',
        ssrStart: 'Next.js의 경우 ',
        ssrAfterInit: '은 또한 루트 레이아웃에 ',
        ssrAfterFn: '를 추가하여 서버 측 ',
        ssrEnd: ' 호출에 태깅합니다. 프로덕션에서는 아무 동작도 하지 않습니다.',
      },
      record: {
        title: '기록, 커밋, 재생',
        noteStart: '',
        noteMid: '로 설정하고 실제 API를 대상으로 한 번 실행한 뒤, ',
        noteEnd:
          '로 전환하고 커밋하세요. 기록은 git에 보관됩니다. 그것이 CI를 결정적으로 만드는 이유입니다. gitignore에 넣지 마세요.',
      },
    },
  },

  cta: {
    heading: '직접 목(mock) 작성은 이제 그만',
    sub: '여러분의 API는 이미 올바른 답을 제공합니다. 기록하기만 하면 됩니다.',
    copyLabel: '복사',
    starCta: 'GitHub에서 스타',
    fineStart:
      '오후 시간을 아끼셨다면, 스타는 1초면 충분합니다. 다음 사람이 이 도구를 발견하는 방법이자, 1인 메인테이너에게 계속 만들라는 신호가 됩니다. 막히는 부분이나 아이디어가 있으신가요? ',
    issueLabel: '이슈를 열거나',
    fineBetween: '또는',
    discordLabel: 'Discord에 참여하세요',
    fineEnd: '.',
  },
};
