// Korean (ko) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=ko source=en.ts source-blob=c698d86206f541e55eef9064035f21550ca9a188 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'Playwright에서 API 호출 기록 및 재생 (SSR 포함)',
    description:
      'Playwright 실행 중에 실제 API 응답을 기록하고 CI에서 재생합니다. Next.js와 TanStack Start의 서버 측 fetch, 브라우저 호출, WebSocket을 지원합니다.',
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
    copied: '복사됨',
  },

  hero: {
    title: 'Playwright 테스트의 API 호출을 서버 측 요청까지 기록하고 재생합니다',
    headlineTop: '한 번 기록하세요.',
    headlineBottom: '영원히 재생하세요.',
    sub: '로컬에서 Playwright를 실행하는 동안 앱이 받는 API 응답을 WebSocket까지 포함해 기록한 다음, 백엔드를 끈 상태로 CI에서 재생합니다.',
    copyLabel: '복사',
    starCta: 'GitHub에서 스타',
    fine: 'MIT · TypeScript · Node ≥ 20 · Next.js 및 TanStack Start SSR, SPA, Chrome 확장 프로그램, WebSocket',
    scenePause: '일시 정지',
    scenePlay: '재생',
  },

  demo: {
    heading: '기록하고 재생하는 모습을 확인하세요',
    sub: '한 번의 Playwright 실행으로 실제 응답을 디스크에 기록합니다. 재생으로 전환하면 동일한 스위트가 백엔드를 끈 상태로 통과합니다.',
    videoLabel:
      '화면 녹화: test-proxy-recorder로 실제 API 응답을 기록한 다음, 백엔드를 끈 상태로 재생하는 모습.',
  },

  mechanisms: {
    heading: '두 가지 기록 방식',
    sub: '요청은 두 곳에서 시작되므로 기록 방식도 두 가지이며, 어느 방식에서든 프록시 프로세스가 실행됩니다. 프록시로 보낸 모든 요청(서버 측 fetch, 서버와 공유하는 API 기본 URL을 거치는 브라우저 호출, WebSocket)은 해당 테스트의 .mock.json에서 재생됩니다. 픽스처의 url 패턴과 일치하는, 다른 호스트로 가는 브라우저 호출은 해당 테스트의 .har에서 재생됩니다.',
    proxy: {
      title: '프록시',
      flow: 'Next.js / TanStack Start SSR → 프록시 → 실제 API',
      body: '서버와 API 사이에 위치합니다. 서버 측 요청(서버 컴포넌트와 SSR의 fetch, 라우트 핸들러, BFF(backend-for-frontend)가 호출하는 모든 것)을 기록합니다.',
      when: '서버가 API를 호출하는 풀스택 앱용.',
      parallel: '각 테스트의 서버 측 요청에는 그 테스트의 id가 붙으므로, 병렬로 실행되는 테스트끼리 기록을 공유하지 않습니다.',
      guideNextjs: 'Next.js 가이드 →',
      guideTanstack: 'TanStack Start 가이드 →',
      exampleNextjs: 'Next.js 예제 보기 →',
      exampleTanstack: 'TanStack Start 예제 보기 →',
    },
    har: {
      title: 'HAR',
      flow: '브라우저 → HAR 가로채기 → 실제 API',
      bodyStart: '브라우저 자체에서 가로채 HTTP Archive(HAR) 파일로 저장합니다. 클라이언트 측',
      bodyEnd: '호출, Chrome 확장 프로그램 API 트래픽, 분석, 서드파티 API 중 픽스처의 url 패턴과 일치하는 것을 기록합니다.',
      when: 'SPA, 확장 프로그램, 브라우저 전용 앱용.',
      proxyNote:
        'routeFromHAR만 쓸 때와 달리, 테스트마다 HAR 파일을 하나씩 만들고 인증 헤더를 마스킹합니다.',
      guidePlaywright: 'Playwright 가이드 →',
      exampleExtension: 'Chrome 확장 프로그램 예제 보기 →',
      exampleVite: 'Vite + WebSocket 예제 보기 →',
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
      'Polly.js는 자신이 실행되는 프로세스 안에서 기록하므로, 서버 측 요청을 기록하려면 앱 서버 안에서 실행해야 합니다. MSW와 Mocky Balboa도 서버 측 요청을 모킹하지만, 응답은 직접 작성해야 합니다. 출처와 다른 도구를 선택해야 하는 경우까지 담은 전체 비교는',
    footLinkLabel: '문서',
    footEnd: '에서 다룹니다.',
    tradeoff:
      '대신 처음 설정은 브라우저 전용 도구보다 손이 더 갑니다. 테스트 옆에서 프록시 프로세스가 실행되고, 서버 측 요청을 위해서는 테스트 실행 중에 앱의 API 기본 URL이 프록시를 가리켜야 합니다.',
  },

  auth: {
    heading: '실제 인증 공급자와 함께 동작',
    sub: "Cognito, Auth0, Clerk 또는 WorkOS를 통해 실제로, 매 실행마다 로그인하세요. 앱의 API만 기록되며, 인증은 계속 실시간으로 동작하고 데이터는 오프라인으로 재생됩니다.",
    links: {
      cognito: 'AWS Cognito 예제 →',
      tanstack: 'TanStack Start의 Cognito →',
      mock: '목(mock) 인증(클라우드 계정 불필요) →',
    },
  },

  recordingSample: {
    heading: '기록 파일은 이렇게 생겼습니다',
    perTest: {
      term: '테스트당 파일 하나',
      start: '각 테스트는 테스트 이름을 딴 파일을 각자 작성하므로,',
      end: '명령으로 그 테스트만 다시 기록할 수 있습니다. 프록시는 한 번에 한 테스트만 기록하므로 워커 하나로 기록하세요. 재생은 병렬로 실행됩니다.',
    },
    testId: {
      term: '테스트 id',
      start: 'Playwright는 테스트가 보내는 모든 요청에',
      mid: '헤더를 붙여 보내고,',
      end: '함수가 이 헤더를 서버가 직접 보내는 fetch에도 복사합니다. 프록시는 이 헤더를 읽어, 테스트가 병렬로 재생될 때에도 각 테스트에 그 테스트의 파일로 응답합니다.',
    },
    secrets: {
      term: '비밀 정보',
      body: 'Authorization, Cookie, Set-Cookie 헤더는 .mock.json 파일에서는 파일을 쓰기 전에, .har 파일에서는 실행이 끝날 때 [REDACTED]로 바뀝니다. 응답 본문 안의 비밀 정보는 직접 패턴을 추가해야 합니다.',
      link: '비밀 정보 마스킹 →',
    },
    caption:
      '실제 기록의 일부입니다(전체 크기 2.6 KB). 한 테스트의 POST 요청으로, Authorization 헤더가 마스킹되어 있습니다. 전체 파일에는 그 뒤에 이어진 GET 요청, 모든 헤더, 요청마다의 타임스탬프도 들어 있습니다.',
  },

  replayQuestions: {
    heading: '재생에 관한 질문',
    matching: {
      term: '요청은 어떻게 매칭되나요?',
      body: '프록시는 서버 측 호출을 본문이 아니라 메서드, 경로, 정확한 쿼리 문자열로 매칭하고, 반복되는 호출에는 기록된 순서대로 응답합니다. 브라우저 호출은 POST 본문도 비교하는 Playwright의 HAR 규칙을 따릅니다. 타임스탬프처럼 실행할 때마다 바뀌는 쿼리 문자열은 결코 일치하지 않으며, 파라미터를 무시하는 옵션도 없으므로 그런 값은 테스트 중에 고정해 두세요.',
      link: '재생이 요청을 매칭하는 방식 →',
    },
    misses: {
      term: '기록이 없으면 어떻게 되나요?',
      start:
        '프록시는 요청과 테스트를 명시한 404로 응답합니다. 기록된 횟수보다 더 많이 한 호출은 마지막 응답을 다시 받고, 프록시 로그에 경고가 남습니다. 브라우저에서는 픽스처가',
      mid: '옵션으로',
      end: '함수에 넘기는 패턴과 일치하지만 HAR에 없는 호출을 Playwright가 중단하며, 그 밖의 호출은 네트워크로 나갑니다.',
    },
    liveApi: {
      term: '재생은 언제 실제 API에 도달하나요?',
      start:
        '재생이 실제 API에 도달하는 것은 프록시가 재생 모드를 벗어난 뒤뿐이며, 프록시는 실행 중인 모든 테스트에 하나의 모드를 유지합니다. 프록시는 마지막 테스트가 시작되고 120초가 지나거나, 테스트별 훅이',
      end: '을 호출하면 재생 모드를 벗어납니다. CI에서 실행 중인 백엔드가 없으면 그런 호출은 통과하지 못하고 실패합니다.',
      link: '세션 시간 초과와 티어다운 →',
    },
    drift: {
      term: 'API가 바뀌면 어떻게 되나요?',
      body: '타입이 지정된 API 클라이언트를 쓴다면, 바뀐 필드에 맞춰 클라이언트를 갱신할 때 그 필드를 쓰는 재생 테스트가 실패합니다. 기록에는 여전히 이전 필드가 남아 있기 때문입니다. 이 실패가 변경 지점을 알려 주며, 다시 기록하면 직접 작성한 목(mock)을 고치는 것보다 적은 수고로 테스트를 고칠 수 있습니다.',
    },
    overrides: {
      term: '오류와 엣지 케이스는 어떻게 테스트하나요?',
      start: '브라우저에서는',
      mid: '핸들러를',
      end: '호출 뒤에 등록하면 기록보다 우선 적용됩니다. 서버 측 응답은 .mock.json 파일에서 수정합니다.',
      link: '응답을 강제로 지정하기 →',
    },
  },

  quickStart: {
    heading: '빠른 시작',
    subStart:
      '한 번의 명령으로 모든 것을 스캐폴딩하고, API를 프록시로 연결한 뒤 기록하고 커밋하세요. 브라우저 전용 앱인가요?',
    subEnd: '이 SSR 단계를 대신 건너뜁니다.',
    tabs: {
      agent: 'AI 에이전트로 설정',
      manual: '직접 설정',
    },
    ai: {
      noteStart:
        '이것을 Claude Code, Cursor 또는 다른 코딩 에이전트에 붙여넣으세요. 에이전트는 먼저 @tanstack/intent를 실행하는데, 이 도구는 CLAUDE.md 같은 에이전트 설정 파일에 안내를 추가해 에이전트가 이 라이브러리의 설정 스킬을 불러오게 합니다. 그다음 패키지를 설치하고, 앱 설정에서 백엔드 URL을 찾고,',
      noteEnd: '명령을 실행한 뒤 그 출력에 따라 연결 작업을 마무리합니다.',
      copyLabel: '프롬프트 복사',
    },
    changes: {
      label: '저장소에서 바뀌는 것',
      tests:
        '테스트 스위트에는 Playwright 픽스처, 프록시 프로세스(테스트 중에만 실행됩니다), git에 커밋하는 기록이 생깁니다.',
      appStart:
        '앱은 서버 측 요청을 기록할 때만 바뀝니다. 테스트 실행 중에는 API 기본 URL이 프록시를 가리키게 하고, Next.js라면 app/layout.tsx에서, TanStack Start라면 src/router.tsx에서',
      appEnd:
        '함수를 한 번 호출합니다. 이 함수는 각 서버 측 fetch에 테스트 id를 복사하며, TEST_PROXY_RECORDER_ENABLED가 설정되지 않으면 프로덕션에서는 아무 동작도 하지 않습니다.',
      agent:
        '에이전트 프롬프트를 쓰면 @tanstack/intent가 CLAUDE.md 같은 에이전트 설정 파일에 이 라이브러리의 스킬을 불러오는 방법에 대한 안내를 추가합니다.',
      deployed:
        '배포된 환경을 테스트하나요? HAR은 앱을 바꾸지 않고도 그 환경의 브라우저 호출을 기록하지만, 페이지 자체는 여전히 그 서버에서 불러옵니다. 서버 측 호출까지 재생하려면 CI에서 프록시 옆에 앱을 실행하세요.',
    },
    steps: {
      install: {
        title: '설치 및 스캐폴딩',
        noteStart: '은 프록시 설정, Playwright 픽스처, 전역 티어다운, ',
        noteEnd:
          ' 스크립트를 작성하고, (Next.js의 경우) SSR fetch 태깅을 루트 레이아웃에 연결합니다. 비파괴적으로 동작합니다.',
      },
      apiEnv: {
        title: '서버 측 API 호출을 프록시로 연결',
        noteStart: '',
        noteEnd:
          '이 추측할 수 없는 유일한 것은 바로 API 기본 URL을 담고 있는 환경 변수입니다. 레코더가 활성화되어 있으면 프록시를, 그렇지 않으면 실제 백엔드를 가리키세요. 프록시는 프로덕션에서 절대 실행되지 않습니다.',
        ssrStart: 'Next.js의 경우 ',
        ssrAfterInit: '은 또한 루트 레이아웃에 ',
        ssrAfterFn: '를 추가하여 서버 측 ',
        ssrEnd: ' 호출에 태깅합니다. 프로덕션에서는 아무 동작도 하지 않습니다.',
        browserOnly:
          '브라우저 전용 앱인가요? 앱이 WebSocket을 열지 않는다면 이 단계는 건너뛰세요. WebSocket은 프록시 주소로 연결할 때만 기록됩니다.',
      },
      record: {
        title: '기록, 커밋, 재생',
        noteStart: '',
        noteMid: '로 설정하고 실제 API를 대상으로 한 번 실행한 뒤, ',
        noteEnd:
          '로 전환하고 커밋하세요. 기록은 git에 보관됩니다. 그것이 CI를 결정적으로 만드는 이유입니다. gitignore에 넣지 마세요.',
      },
    },
    guideLink: '전체 설정 가이드 →',
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
