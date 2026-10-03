// Chinese (Simplified) (zh-CN) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=zh-CN source=en.ts source-blob=c698d86206f541e55eef9064035f21550ca9a188 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: '在 Playwright 中录制与回放 API 调用，包括 SSR',
    description:
      '在 Playwright 运行期间录制真实的 API 响应，并在 CI 上回放。覆盖 Next.js 与 TanStack Start 的服务端 fetch、浏览器调用和 WebSocket。',
    ogImageAlt:
      'test-proxy-recorder —— 录制一次，永久回放。录制与回放模式的示意图。',
  },

  chrome: {
    skipToContent: '跳到主要内容',
    navQuickStart: '快速开始',
    navDocs: '文档',
    updated: '更新于',
    licensed: 'MIT 许可。',
    languageLabel: '语言',
    copied: '已复制',
  },

  hero: {
    title: '在 Playwright 测试中录制与回放 API 调用，包括服务端请求',
    headlineTop: '录制一次。',
    headlineBottom: '永久回放。',
    sub: '录制本地 Playwright 运行期间你的应用收到的 API 响应（包括 WebSocket），随后在 CI 上回放，后端保持关闭。',
    copyLabel: '复制',
    starCta: '在 GitHub 上加星',
    fine: 'MIT · TypeScript · Node ≥ 20 · Next.js 与 TanStack Start SSR、SPA、Chrome 扩展、WebSocket',
    scenePause: '暂停',
    scenePlay: '播放',
  },

  demo: {
    heading: '看它录制，再回放',
    sub: '一次 Playwright 运行把真实响应录制到磁盘；翻转到回放，同一套件在后端关闭的情况下通过。',
    videoLabel:
      '屏幕录制：用 test-proxy-recorder 录制真实 API 响应，然后在关闭后端的情况下回放它们。',
  },

  mechanisms: {
    heading: '两种录制方式',
    sub: '请求从两个地方发出，所以有两种录制方式，并且两种方式下代理进程都会运行。发往代理的一切请求（服务端 fetch、经由与服务器共用的 API 基础 URL 发出的浏览器调用、WebSocket）都从该测试的 .mock.json 回放。发往其他主机、且匹配你的 fixture 中 url 模式的浏览器调用，则从该测试的 .har 回放。',
    proxy: {
      title: '代理',
      flow: 'Next.js / TanStack Start SSR → 代理 → 真实 API',
      body: '位于你的服务器与 API 之间。录制服务端请求：Server Component 和 SSR 发出的 fetch、route handler，以及你的 backend-for-frontend 所调用的任何内容。',
      when: '适用于服务器调用 API 的全栈应用。',
      parallel: '每个测试的服务端请求都带有该测试的 id，因此并行运行的测试绝不会共用同一份录制。',
      guideNextjs: 'Next.js 指南 →',
      guideTanstack: 'TanStack Start 指南 →',
      exampleNextjs: '查看 Next.js 示例 →',
      exampleTanstack: '查看 TanStack Start 示例 →',
    },
    har: {
      title: 'HAR',
      flow: '浏览器 → HAR 拦截 → 真实 API',
      bodyStart: '在浏览器内部进行拦截，并保存一个 HTTP Archive（HAR）文件。录制客户端',
      bodyEnd: '调用、Chrome 扩展 API 流量、分析数据和第三方 API，只要它们匹配你的 fixture 中的 url 模式。',
      when: '适用于 SPA、扩展和纯浏览器应用。',
      proxyNote: '与直接使用 routeFromHAR 相比，它为每个测试单独生成一个 HAR，并涂抹认证 header。',
      guidePlaywright: 'Playwright 指南 →',
      exampleExtension: '查看 Chrome 扩展示例 →',
      exampleVite: '查看 Vite + WebSocket 示例 →',
    },
  },

  compare: {
    heading: '它适合什么场景',
    sub: '不同的 mock 工具擅长不同的工作。下面的组合 —— 跨 SSR、浏览器和 WebSocket 录制真实流量，且不手写 mock —— 正是其他工具留下的空白。',
    tableCaption:
      'test-proxy-recorder 与 Playwright routeFromHAR、MSW、Polly.js、playwright-network-cache 和 Mocky Balboa 的特性对比。',
    featureLabel: '特性',
    features: [
      '录制真实流量',
      '服务端（SSR）',
      '浏览器端',
      'WebSocket',
      'Playwright 原生',
      '维护中',
    ],
    markText: { y: '是', n: '否', p: '部分' },
    footStart:
      'Polly.js 在它所运行的进程内部录制，所以对于服务端请求，它必须运行在你的应用服务器内部。MSW 和 Mocky Balboa 也能 mock 服务端请求，但响应要你自己编写。完整的对比（附来源，以及何时该选用其他工具）见',
    footLinkLabel: '文档',
    footEnd: '。',
    tradeoff:
      '代价是首次搭建比纯浏览器端的工具更费事：需要在测试旁运行一个代理进程；对于服务端请求，测试运行期间还要把应用的 API 基础 URL 指向它。',
  },

  auth: {
    heading: '与你的真实认证提供方配合工作',
    sub: '通过 Cognito、Auth0、Clerk 或 WorkOS 登录 —— 每次运行都真实进行。只有你应用的 API 会被录制；认证保持在线，你的数据离线处理。',
    links: {
      cognito: 'AWS Cognito 示例 →',
      tanstack: 'TanStack Start 上的 Cognito →',
      mock: 'Mock 认证（无需云账号） →',
    },
  },

  recordingSample: {
    heading: '录制文件是什么样的',
    perTest: {
      term: '每个测试一个文件',
      start: '每个测试都写入自己的文件，并以测试名命名，因此',
      end: '只会重新录制这一个测试。代理一次只录制一个测试，所以录制时请只用一个 worker；回放则可以并行运行。',
    },
    testId: {
      term: '测试的 id',
      start: 'Playwright 会在测试发出的每个请求上附带',
      mid: 'header，而',
      end: '会把它复制到你的服务器自己发出的 fetch 上。代理读取这个 id，从每个测试自己的文件中为它返回响应，即使测试并行回放也是如此。',
    },
    secrets: {
      term: '机密',
      body: 'Authorization、Cookie 和 Set-Cookie header 的值会变成 [REDACTED]：.mock.json 文件在写入之前就已替换，.har 文件则在运行结束时替换。响应体中的机密需要你自己添加匹配模式。',
      link: '机密涂抹 →',
    },
    caption:
      '一份真实录制的片段（完整文件 2.6 KB）：某个测试发出的 POST 请求，其 Authorization header 已被涂抹。完整文件还包含随后的 GET 请求、全部 header，以及每个请求的时间戳。',
  },

  replayQuestions: {
    heading: '关于回放的问题',
    matching: {
      term: '请求如何匹配？',
      body: '代理按方法、路径和完全一致的查询字符串匹配服务端调用，不比较请求体；重复的调用按录制顺序依次应答。浏览器调用遵循 Playwright 的 HAR 规则，该规则还会比较 POST 请求体。每次运行都会变化的查询字符串（例如时间戳）永远无法匹配，而且没有任何选项可以忽略某个参数，所以测试期间请让这类值保持固定。',
      link: '回放如何匹配请求 →',
    },
    misses: {
      term: '缺少录制时会怎样？',
      start:
        '代理会返回 404，并指明是哪个请求、哪个测试。某个调用的次数超过录制的次数时，会再次得到最后一个响应，同时代理日志中会出现一条警告。在浏览器中，如果某个调用匹配',
      mid: '模式（即你的 fixture 传给',
      end: '的模式），但不在 HAR 中，Playwright 会中止它；其他调用则会发往网络。',
    },
    liveApi: {
      term: '回放何时会访问真实 API？',
      start:
        '只有在代理离开回放模式之后，回放才会访问真实 API，而代理对所有正在运行的测试只保持一种模式。代理在两种情况下离开回放模式：最后一个测试启动 120 秒后，或者测试中的某个钩子调用了',
      end: '。CI 中没有运行后端时，这样的调用会失败，而不是通过。',
      link: '会话超时与 teardown →',
    },
    drift: {
      term: 'API 变化时会怎样？',
      body: '如果使用带类型的 API 客户端，为某个变化的字段更新客户端后，用到该字段的回放测试会失败，因为录制中仍是旧字段。这会指出变化所在，而重新录制即可修复这些测试，比修改手写 mock 省力。',
    },
    overrides: {
      term: '如何测试错误和边界情况？',
      start: '在浏览器中，用',
      mid: '在',
      end: '之后注册的路由处理函数会覆盖录制。服务端响应则在 .mock.json 文件中编辑。',
      link: '强制指定响应 →',
    },
  },

  quickStart: {
    heading: '快速开始',
    subStart:
      '用一条命令脚手架生成所有内容，把 API 指向代理，然后录制并提交。纯浏览器应用？',
    subEnd: '会替你跳过 SSR 步骤。',
    tabs: {
      agent: '使用 AI agent',
      manual: '手动设置',
    },
    ai: {
      noteStart:
        '把它粘贴到 Claude Code、Cursor 或其他编码 agent 中。它会先运行 @tanstack/intent，在 agent 的配置文件（例如 CLAUDE.md）中加入指引，让 agent 加载本库的设置技能。然后它会安装这个包，从应用的配置中找到你的后端 URL，运行',
      noteEnd: '并根据它的输出完成剩下的接入工作。',
      copyLabel: '复制提示词',
    },
    changes: {
      label: '你的仓库会有哪些变化',
      tests:
        '在你的测试套件中：一个 Playwright fixture、代理进程（只在测试期间运行），以及提交到 git 的录制文件。',
      appStart:
        '在你的应用中（仅限服务端请求）：测试运行期间把 API 基础 URL 指向代理，并在 Next.js 的 app/layout.tsx 或 TanStack Start 的 src/router.tsx 中调用一次',
      appEnd:
        '函数。它会把测试的 id 复制到每个服务端 fetch 上；除非设置了 TEST_PROXY_RECORDER_ENABLED，否则它在生产环境中什么也不做。',
      agent:
        '使用 agent 提示词时：@tanstack/intent 会在 agent 的配置文件（例如 CLAUDE.md）中加入加载本库技能的指引。',
      deployed:
        '测试的是已部署的环境？HAR 无需改动应用就能录制其浏览器调用，但页面本身仍从那台服务器加载。若还要回放服务端调用，请在 CI 中把应用和代理放在一起运行。',
    },
    steps: {
      install: {
        title: '安装与脚手架',
        noteStart: '会写入代理配置、一个 Playwright fixture、一个全局 teardown、',
        noteEnd:
          '脚本，并（在 Next.js 上）把 SSR fetch 打标接入你的 root layout —— 全程非破坏性。',
      },
      apiEnv: {
        title: '把服务端 API 调用指向代理',
        noteStart: '唯一',
        noteEnd:
          '猜不到的事情：哪个环境变量保存着你的 API 基础 URL。在录制器启用时把它指向代理，其余情况指向真实后端 —— 代理绝不在生产环境中运行。',
        ssrStart: '在 Next.js 上，',
        ssrAfterInit: '还会添加',
        ssrAfterFn: '到你的 root layout，给服务端的',
        ssrEnd: '调用打标 —— 在生产环境中是 no-op。',
        browserOnly:
          '纯浏览器应用？如果应用不打开 WebSocket，可以跳过这一步；WebSocket 只有连接到代理的地址时才会被录制。',
      },
      record: {
        title: '录制、提交、回放',
        noteStart: '设置',
        noteMid: '，针对真实 API 运行一次，然后翻转到',
        noteEnd:
          '并提交。录制内容存放在 git 中 —— 这正是 CI 具有确定性的原因。不要 gitignore 它们。',
      },
    },
    guideLink: '完整设置指南 →',
  },

  cta: {
    heading: '停止手写 mock',
    sub: '你的 API 已经给出正确答案。把它们录制下来。',
    copyLabel: '复制',
    starCta: '在 GitHub 上加星',
    fineStart:
      '如果它帮你省下了一个下午，点一颗 star 只要一秒钟 —— 这就是下一个人找到它的方式，也是在告诉一个独自维护的人继续做下去。遇到卡壳或有想法？',
    issueLabel: '提交 issue',
    fineBetween: '或',
    discordLabel: '加入 Discord',
    fineEnd: '。',
  },
};
