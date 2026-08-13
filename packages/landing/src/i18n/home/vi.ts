// Vietnamese (vi) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=vi source=en.ts source-blob=0e5944e1211d8ba9dcc934fd3c041fc41e109d01 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'VCR cho Playwright — ghi & phát lại API | test-proxy-recorder',
    description:
      'Ghi & phát lại kiểu VCR cho Playwright. Ghi lại response API thật một lần, phát lại chúng một cách tất định trên CI — không cần backend, không cần mock viết tay. Proxy SSR + HAR trình duyệt, WebSockets. Miễn phí & MIT.',
    ogImageAlt:
      'test-proxy-recorder — record once, replay forever. Sơ đồ các chế độ ghi lại và phát lại.',
  },

  chrome: {
    skipToContent: 'Bỏ qua tới nội dung',
    navQuickStart: 'Bắt đầu nhanh',
    navDocs: 'Tài liệu',
    updated: 'Đã cập nhật',
    licensed: 'Giấy phép MIT.',
    languageLabel: 'Ngôn ngữ',
  },

  hero: {
    eyebrow: 'VCR for Playwright',
    headlineTop: 'Ghi lại một lần.',
    headlineBottom: 'Phát lại mãi mãi.',
    sub: 'Ghi lại các response API thật trong khi bộ Playwright của bạn chạy cục bộ, rồi phát lại chúng từng byte trên CI. Không cần backend, không cần mạng, không có mock viết tay để bảo trì.',
    copyLabel: 'Sao chép',
    starCta: 'Star trên GitHub',
    starCountAlt: 'Số star trên GitHub',
    fine: 'MIT · TypeScript · hoạt động với SSR của Next.js & TanStack Start, SPA & extension Chrome · hỗ trợ WebSocket',
  },

  demo: {
    heading: 'Xem nó ghi lại, rồi phát lại',
    sub: 'Một lần chạy Playwright ghi các response thật ra đĩa; lật sang phát lại và cùng bộ test đó pass với backend đã tắt — không cần mạng.',
    videoLabel:
      'Bản ghi màn hình: ghi lại các response API thật bằng test-proxy-recorder, rồi phát lại chúng với backend đã tắt.',
  },

  mechanisms: {
    heading: 'Hai bộ ghi lại, một proxy',
    sub: 'Request xuất phát từ hai nơi, nên có hai cơ chế ghi lại. Dùng một trong hai — hoặc cả hai cùng lúc. Cả hai đều ghi lại một lần và phát lại từ đĩa, nên CI chạy với backend đã tắt và không cần mock viết tay.',
    proxy: {
      title: 'Proxy',
      flow: 'SSR của Next.js / TanStack Start → proxy → API thật',
      body: 'Nằm giữa máy chủ của bạn và API. Ghi lại các request phía máy chủ — fetch SSR, route handler, bất cứ thứ gì backend-for-frontend của bạn gọi.',
      when: 'Cho các ứng dụng full-stack nơi máy chủ gọi API.',
      exampleNextjs: 'Xem ví dụ Next.js →',
      exampleTanstack: 'Xem ví dụ TanStack Start →',
    },
    har: {
      title: 'HAR',
      flow: 'trình duyệt → HAR intercept → API thật',
      bodyStart: 'Chặn ngay trong trình duyệt. Ghi lại các lời gọi',
      bodyEnd: 'phía client, traffic API của extension Chrome, analytics, API bên thứ ba.',
      when: 'Cho SPA, extension, và các ứng dụng chỉ chạy trên trình duyệt.',
      exampleExtension: 'Xem ví dụ extension Chrome →',
    },
  },

  compare: {
    heading: 'Vị trí của nó',
    sub: 'Các công cụ mocking giỏi ở những việc khác nhau. Sự kết hợp bên dưới — ghi lại traffic thật trên cả SSR, trình duyệt, và WebSockets, không cần mock viết tay — chính là khoảng trống các công cụ khác để lại.',
    tableCaption:
      'So sánh tính năng giữa test-proxy-recorder với Playwright routeFromHAR, MSW, Polly.js, playwright-network-cache, và Mocky Balboa.',
    featureLabel: 'Tính năng',
    features: [
      'Ghi lại traffic thật',
      'Phía máy chủ (SSR)',
      'Phía trình duyệt',
      'WebSocket',
      'Thuần Playwright',
      'Được bảo trì',
    ],
    markText: { y: 'Có', n: 'Không', p: 'Một phần' },
    footStart:
      'Polly.js chặn HTTP của Node, nên việc mock SSR có thể thực hiện bên trong tiến trình ứng dụng, nhưng không phải như một phần của lần chạy Playwright. MSW và Mocky Balboa cũng phát lại các response thật — nhưng bạn phải viết mock bằng tay. Khi nào nên chọn thứ khác được trình bày trong',
    footLinkLabel: 'tài liệu',
    footEnd: '.',
  },

  auth: {
    heading: 'Hoạt động với auth provider thật của bạn',
    sub: "Đăng nhập qua Cognito, Auth0, Clerk, hoặc WorkOS — thật sự, trong mỗi lần chạy. Chỉ API của ứng dụng bạn được ghi lại; auth vẫn trực tiếp, dữ liệu của bạn chuyển sang offline.",
    links: {
      cognito: 'Ví dụ AWS Cognito →',
      tanstack: 'Cognito trên TanStack Start →',
      mock: 'Mock auth (không cần tài khoản cloud) →',
    },
  },

  quickStart: {
    heading: 'Thiết lập trong ba bước',
    subStart:
      'Dựng mọi thứ bằng một lệnh, trỏ API của bạn về proxy, rồi ghi lại và commit. Ứng dụng chỉ chạy trên trình duyệt?',
    subEnd: 'sẽ bỏ qua bước SSR giúp bạn.',
    ai: {
      heading: 'Đường nhanh nhất: giao cho AI agent của bạn',
      noteStart:
        'Sao chép đoạn này, thay URL backend của bạn vào, và dán vào Claude Code, Cursor, hoặc bất kỳ coding agent nào — nó chạy',
      noteMid: 'và hoàn tất việc kết nối từ prompt',
      noteEnd: 'in ra.',
      copyLabel: 'Sao chép',
    },
    manualIntro: 'Hoặc tự kết nối bằng tay:',
    steps: {
      install: {
        title: 'Cài đặt & dựng khung',
        noteStart: 'viết cấu hình proxy, một Playwright fixture, một global teardown,',
        noteEnd:
          'script, và (trên Next.js) kết nối việc gắn thẻ fetch SSR vào root layout của bạn — một cách không phá hoại.',
      },
      apiEnv: {
        title: "Trỏ API của ứng dụng bạn về proxy",
        noteStart: 'Điều duy nhất',
        noteEnd:
          "không thể đoán: biến env nào chứa base URL API của bạn. Trỏ nó về proxy khi recorder được bật, về backend thật trong trường hợp còn lại — proxy không bao giờ chạy trong production.",
        ssrStart: 'Trên Next.js,',
        ssrAfterInit: 'cũng thêm',
        ssrAfterFn: 'vào root layout của bạn để gắn thẻ cho các lời gọi',
        ssrEnd: 'phía máy chủ — một no-op trong production:',
      },
      record: {
        title: 'Ghi lại, commit, phát lại',
        noteStart: 'Đặt',
        noteMid: ', chạy một lần dựa trên API thật, rồi lật sang',
        noteEnd:
          "và commit. Các bản ghi nằm trong git — đó là điều làm CI tất định. Đừng gitignore chúng.",
      },
    },
  },

  cta: {
    heading: 'Ngừng viết mock bằng tay',
    sub: 'API của bạn đã cho sẵn câu trả lời đúng. Hãy ghi lại chúng.',
    copyLabel: 'Sao chép',
    starCta: 'Star trên GitHub',
    fineStart:
      "Nếu nó giúp bạn tiết kiệm một buổi chiều, một star chỉ mất một giây — đó là cách người tiếp theo tìm thấy nó, và nó báo cho một maintainer độc lập rằng hãy tiếp tục xây dựng. Gặp trục trặc hay có ý tưởng?",
    issueLabel: 'Mở một issue',
    fineBetween: 'hoặc',
    discordLabel: 'tham gia Discord',
    fineEnd: '.',
  },
};
