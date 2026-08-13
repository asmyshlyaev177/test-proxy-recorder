// Chinese (Simplified) (zh-CN) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=zh-CN source=en.ts source-blob=0e5944e1211d8ba9dcc934fd3c041fc41e109d01 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'Playwright 的 VCR —— 录制与回放 API 响应 | test-proxy-recorder',
    description:
      'Playwright 的 VCR 式录制与回放。录制一次真实 API 响应，在 CI 上确定性回放 —— 无需后端，无需手写 mock。支持 SSR 代理 + 浏览器 HAR、WebSocket。免费且 MIT 许可。',
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
  },

  hero: {
    eyebrow: 'Playwright 的 VCR',
    headlineTop: '录制一次。',
    headlineBottom: '永久回放。',
    sub: '在你的 Playwright 套件本地运行时捕获真实 API 响应，然后在 CI 上逐字节地回放它们。无需后端、无需网络，也无需维护手写 mock。',
    copyLabel: '复制',
    starCta: '在 GitHub 上加星',
    starCountAlt: 'GitHub 加星数',
    fine: 'MIT · TypeScript · 支持 Next.js 与 TanStack Start SSR、SPA 和 Chrome 扩展 · 支持 WebSocket',
  },

  demo: {
    heading: '看它录制，再回放',
    sub: '一次 Playwright 运行把真实响应录制到磁盘；翻转到回放，同一套件在后端关闭的情况下通过 —— 无需网络。',
    videoLabel:
      '屏幕录制：用 test-proxy-recorder 录制真实 API 响应，然后在关闭后端的情况下回放它们。',
  },

  mechanisms: {
    heading: '两种录制器，一个代理',
    sub: '请求来自两个地方，因此有两种录制机制。使用其中一种 —— 或两者同时使用。两者都是录制一次并从磁盘回放，因此 CI 在后端关闭、没有手写 mock 的情况下运行。',
    proxy: {
      title: '代理',
      flow: 'Next.js / TanStack Start SSR → 代理 → 真实 API',
      body: '位于你的服务器与 API 之间。录制服务端请求 —— SSR fetch、route handler，以及你的 backend-for-frontend 所调用的任何内容。',
      when: '适用于服务器调用 API 的全栈应用。',
      exampleNextjs: '查看 Next.js 示例 →',
      exampleTanstack: '查看 TanStack Start 示例 →',
    },
    har: {
      title: 'HAR',
      flow: '浏览器 → HAR 拦截 → 真实 API',
      bodyStart: '在浏览器内部进行拦截。录制客户端',
      bodyEnd: '调用、Chrome 扩展 API 流量、分析数据、第三方 API。',
      when: '适用于 SPA、扩展和纯浏览器应用。',
      exampleExtension: '查看 Chrome 扩展示例 →',
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
      'Polly.js 拦截 Node HTTP，所以 SSR mock 可以在应用进程内部实现，但无法作为 Playwright 运行的一部分。MSW 和 Mocky Balboa 也能回放真实响应 —— 但你需要手写 mock。何时改用其他工具，参见',
    footLinkLabel: '文档',
    footEnd: '。',
  },

  auth: {
    heading: '与你的真实认证提供方配合工作',
    sub: '通过 Cognito、Auth0、Clerk 或 WorkOS 登录 —— 每次运行都真实进行。只有你应用的 API 会被录制；认证保持在线，你的数据离线处理。',
    links: {
      cognito: 'AWS Cognito 示例 →',
      tanstack: 'TanStack Start 上的 Cognito →',
      mock: 'Mock 认证（无需云账号）→',
    },
  },

  quickStart: {
    heading: '三步完成搭建',
    subStart:
      '用一条命令脚手架生成所有内容，把 API 指向代理，然后录制并提交。纯浏览器应用？',
    subEnd: '会替你跳过 SSR 步骤。',
    ai: {
      heading: '最快路径：交给你的 AI agent',
      noteStart:
        '复制这段内容，换成你的后端 URL，然后粘贴到 Claude Code、Cursor 或任何编码 agent 中 —— 它会运行',
      noteMid: '并根据提示完成接线，而提示由',
      noteEnd: '打印。',
      copyLabel: '复制',
    },
    manualIntro: '或者手动接线：',
    steps: {
      install: {
        title: '安装与脚手架',
        noteStart: '会写入代理配置、一个 Playwright fixture、一个全局 teardown、',
        noteEnd:
          '脚本，并（在 Next.js 上）把 SSR fetch 打标接入你的 root layout —— 全程非破坏性。',
      },
      apiEnv: {
        title: '把应用的 API 指向代理',
        noteStart: '唯一',
        noteEnd:
          '猜不到的事情：哪个环境变量保存着你的 API 基础 URL。在录制器启用时把它指向代理，其余情况指向真实后端 —— 代理绝不在生产环境中运行。',
        ssrStart: '在 Next.js 上，',
        ssrAfterInit: '还会添加',
        ssrAfterFn: '到你的 root layout，给服务端的',
        ssrEnd: '调用打标 —— 在生产环境中是 no-op：',
      },
      record: {
        title: '录制、提交、回放',
        noteStart: '设置',
        noteMid: '，针对真实 API 运行一次，然后翻转到',
        noteEnd:
          '并提交。录制内容存放在 git 中 —— 这正是 CI 具有确定性的原因。不要 gitignore 它们。',
      },
    },
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
