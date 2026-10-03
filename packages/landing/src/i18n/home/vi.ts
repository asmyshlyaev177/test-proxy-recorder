// Vietnamese (vi) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=vi source=en.ts source-blob=c698d86206f541e55eef9064035f21550ca9a188 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'Ghi lại và phát lại lời gọi API trong Playwright, kể cả SSR',
    description:
      'Ghi lại response API thật khi chạy Playwright và phát lại trên CI. Bao phủ fetch phía máy chủ của Next.js và TanStack Start, lời gọi trình duyệt, WebSocket.',
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
    copied: 'Đã sao chép',
  },

  hero: {
    title: 'Ghi lại và phát lại lời gọi API trong test Playwright, kể cả request phía máy chủ',
    headlineTop: 'Ghi lại một lần.',
    headlineBottom: 'Phát lại mãi mãi.',
    sub: 'Ghi lại các response API mà ứng dụng của bạn nhận được trong một lần chạy Playwright cục bộ, kể cả WebSocket, rồi phát lại chúng trên CI với backend đã tắt.',
    copyLabel: 'Sao chép',
    starCta: 'Star trên GitHub',
    fine: 'MIT · TypeScript · Node ≥ 20 · SSR của Next.js & TanStack Start, SPA, extension Chrome, WebSocket',
    scenePause: 'Tạm dừng',
    scenePlay: 'Phát',
  },

  demo: {
    heading: 'Xem nó ghi lại, rồi phát lại',
    sub: 'Một lần chạy Playwright ghi các response thật ra đĩa; lật sang phát lại và cùng bộ test đó pass với backend đã tắt.',
    videoLabel:
      'Bản ghi màn hình: ghi lại các response API thật bằng test-proxy-recorder, rồi phát lại chúng với backend đã tắt.',
  },

  mechanisms: {
    heading: 'Hai cách ghi lại',
    sub: 'Request xuất phát từ hai nơi, nên có hai cách ghi lại chúng, và tiến trình proxy chạy trong cả hai trường hợp. Mọi thứ gửi tới proxy (fetch phía máy chủ, lời gọi trình duyệt qua một base URL API dùng chung với máy chủ, WebSocket) được phát lại từ file .mock.json của test. Lời gọi trình duyệt tới các host khác khớp với pattern url trong fixture của bạn được phát lại từ file .har của test.',
    proxy: {
      title: 'Proxy',
      flow: 'SSR của Next.js / TanStack Start → proxy → API thật',
      body: 'Nằm giữa máy chủ của bạn và API. Ghi lại các request phía máy chủ: fetch từ Server Component và SSR, route handler, bất cứ thứ gì backend-for-frontend của bạn gọi.',
      when: 'Cho các ứng dụng full-stack nơi máy chủ gọi API.',
      parallel: 'Các request phía máy chủ của mỗi test mang theo id của test đó, nên các test chạy song song không bao giờ dùng chung một bản ghi.',
      guideNextjs: 'Hướng dẫn Next.js\u00a0→',
      guideTanstack: 'Hướng dẫn TanStack Start\u00a0→',
      exampleNextjs: 'Xem ví dụ Next.js\u00a0→',
      exampleTanstack: 'Xem ví dụ TanStack Start\u00a0→',
    },
    har: {
      title: 'HAR',
      flow: 'trình duyệt → HAR intercept → API thật',
      bodyStart: 'Chặn ngay trong trình duyệt và lưu một file HTTP Archive (HAR). Ghi lại các lời gọi',
      bodyEnd: 'phía client, traffic API của extension Chrome, analytics và API bên thứ ba, với điều kiện chúng khớp với pattern url trong fixture của bạn.',
      when: 'Cho SPA, extension, và các ứng dụng chỉ chạy trên trình duyệt.',
      proxyNote: 'So với routeFromHAR thuần, nó thêm một file HAR cho mỗi test và loại bỏ bí mật khỏi các header auth.',
      guidePlaywright: 'Hướng dẫn Playwright\u00a0→',
      exampleExtension: 'Xem ví dụ extension Chrome\u00a0→',
      exampleVite: 'Xem ví dụ Vite + WebSocket\u00a0→',
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
      'Polly.js ghi lại bên trong tiến trình mà nó chạy, nên với các request phía máy chủ, nó phải chạy bên trong máy chủ ứng dụng của bạn. MSW và Mocky Balboa cũng mock các request phía máy chủ, nhưng bạn phải tự viết các response. Bản so sánh đầy đủ, kèm nguồn và khi nào nên chọn công cụ khác, nằm trong',
    footLinkLabel: 'tài liệu',
    footEnd: '.',
    tradeoff:
      'Đổi lại, lần thiết lập đầu tiên phức tạp hơn so với các công cụ chỉ chạy trên trình duyệt: một tiến trình proxy chạy cạnh các test của bạn, và với các request phía máy chủ, base URL API của ứng dụng trỏ về proxy trong lúc chạy test.',
  },

  auth: {
    heading: 'Hoạt động với auth provider thật của bạn',
    sub: "Đăng nhập qua Cognito, Auth0, Clerk, hoặc WorkOS — thật sự, trong mỗi lần chạy. Chỉ API của ứng dụng bạn được ghi lại; auth vẫn trực tiếp, dữ liệu của bạn chuyển sang offline.",
    links: {
      cognito: 'Ví dụ AWS Cognito\u00a0→',
      tanstack: 'Cognito trên TanStack Start\u00a0→',
      mock: 'Mock auth (không cần tài khoản cloud)\u00a0→',
    },
  },

  recordingSample: {
    heading: 'Một bản ghi trông như thế nào',
    perTest: {
      term: 'Mỗi test một file',
      start: 'Mỗi test ghi ra file riêng, đặt tên theo test, nên',
      end: 'chỉ ghi lại lần nữa đúng test đó. Proxy ghi lại từng test một, nên hãy ghi lại với một worker; còn phát lại thì chạy song song.',
    },
    testId: {
      term: 'Id của test',
      start: 'Playwright gửi',
      mid: 'kèm mọi request mà một test thực hiện, và',
      end: 'sao chép nó sang các fetch của chính máy chủ bạn. Proxy đọc nó để trả lời mỗi test từ file riêng của test đó, ngay cả khi các test phát lại song song.',
    },
    secrets: {
      term: 'Bí mật',
      body: 'Các header Authorization, Cookie và Set-Cookie trở thành [REDACTED] trong file .mock.json trước khi file được ghi ra đĩa, và trong file .har khi lần chạy kết thúc. Bí mật nằm bên trong body của response cần pattern do bạn tự thêm.',
      link: 'Loại bỏ bí mật\u00a0→',
    },
    caption:
      'Một phần của một bản ghi thật, đầy đủ là 2.6 KB: request POST từ một test, với giá trị header Authorization đã được loại bỏ. Toàn bộ file còn chứa request GET theo sau, mọi header, và một dấu thời gian cho mỗi request.',
  },

  replayQuestions: {
    heading: 'Câu hỏi về phát lại',
    matching: {
      term: 'Request được khớp như thế nào?',
      body: 'Proxy khớp một lời gọi phía máy chủ theo method, path và query string chính xác của nó, không theo body, và trả về các lời gọi lặp lại theo đúng thứ tự chúng được ghi lại. Lời gọi trình duyệt theo quy tắc HAR của Playwright, vốn so sánh cả body của POST. Một query string thay đổi mỗi lần chạy, chẳng hạn một dấu thời gian, sẽ không bao giờ khớp, và không có tùy chọn nào để bỏ qua một tham số, nên hãy giữ cố định các giá trị như vậy trong lúc test.',
      link: 'Cách phát lại khớp request\u00a0→',
    },
    misses: {
      term: 'Nếu thiếu bản ghi thì sao?',
      start:
        'Proxy trả về 404 và nêu tên request cùng test. Một lời gọi được thực hiện nhiều lần hơn số lần nó được ghi lại sẽ nhận lại response cuối cùng, kèm một cảnh báo trong log của proxy. Trong trình duyệt, Playwright hủy một lời gọi khớp với pattern',
      mid: 'mà fixture của bạn truyền cho',
      end: 'nhưng không có trong HAR; các lời gọi khác đi ra mạng.',
    },
    liveApi: {
      term: 'Khi nào phát lại gọi tới API thật?',
      start:
        'Phát lại chỉ gọi tới API thật sau khi proxy rời chế độ phát lại, và proxy giữ một chế độ chung cho mọi test đang chạy. Nó rời chế độ phát lại 120 giây sau khi test cuối cùng bắt đầu, hoặc khi một hook theo từng test gọi',
      end: '. Khi không có backend nào chạy trên CI, một lời gọi như vậy sẽ thất bại thay vì pass.',
      link: 'Timeout của session và teardown\u00a0→',
    },
    drift: {
      term: 'Điều gì xảy ra khi API thay đổi?',
      body: 'Với một API client có kiểu, việc cập nhật client theo một trường đã thay đổi sẽ làm các test phát lại dùng trường đó thất bại, vì các bản ghi vẫn giữ trường cũ. Điều đó chỉ cho bạn thấy thay đổi, và ghi lại lần nữa sẽ sửa các test với ít công sức hơn so với chỉnh sửa các mock viết tay.',
    },
    overrides: {
      term: 'Làm sao để test lỗi và các trường hợp biên?',
      start: 'Trong trình duyệt, một',
      mid: 'được đăng ký sau',
      end: 'sẽ được ưu tiên hơn bản ghi. Còn response phía máy chủ thì được chỉnh sửa trong file .mock.json.',
      link: 'Ép một response\u00a0→',
    },
  },

  quickStart: {
    heading: 'Bắt đầu nhanh',
    subStart:
      'Dựng mọi thứ bằng một lệnh, trỏ API của bạn về proxy, rồi ghi lại và commit. Ứng dụng chỉ chạy trên trình duyệt?',
    subEnd: 'sẽ bỏ qua bước SSR giúp bạn.',
    tabs: {
      agent: 'Với AI agent của bạn',
      manual: 'Bằng tay',
    },
    ai: {
      noteStart:
        'Dán đoạn này vào Claude Code, Cursor hoặc một coding agent khác. Trước tiên nó chạy @tanstack/intent, công cụ thêm hướng dẫn vào file cấu hình của agent, chẳng hạn CLAUDE.md, để agent nạp các skill thiết lập của thư viện này. Sau đó nó cài package, tìm URL backend của bạn trong cấu hình của ứng dụng, chạy',
      noteEnd: 'và hoàn tất phần kết nối dựa trên output của lệnh đó.',
      copyLabel: 'Sao chép prompt',
    },
    changes: {
      label: 'Những gì thay đổi trong repo của bạn',
      tests:
        'Trong bộ test của bạn: một Playwright fixture, tiến trình proxy (chỉ chạy trong lúc test), và các bản ghi được commit vào git.',
      appStart:
        'Trong ứng dụng của bạn, chỉ cho các request phía máy chủ: trỏ base URL API về proxy trong lúc chạy test, và gọi',
      appEnd:
        'một lần, trong app/layout.tsx trên Next.js hoặc src/router.tsx trên TanStack Start. Nó sao chép id của test vào mỗi fetch phía máy chủ và không làm gì trong production trừ khi TEST_PROXY_RECORDER_ENABLED được đặt.',
      agent:
        'Với prompt cho agent: @tanstack/intent thêm hướng dẫn nạp các skill của thư viện này vào file cấu hình của agent, chẳng hạn CLAUDE.md.',
      deployed:
        'Đang test một môi trường đã deploy? HAR ghi lại các lời gọi trình duyệt của nó mà không cần thay đổi ứng dụng, nhưng bản thân các trang vẫn được tải từ máy chủ đó. Để phát lại cả các lời gọi phía máy chủ, hãy chạy ứng dụng trên CI cạnh proxy.',
    },
    steps: {
      install: {
        title: 'Cài đặt & dựng khung',
        noteStart: 'viết cấu hình proxy, một Playwright fixture, một global teardown,',
        noteEnd:
          'script, và (trên Next.js) kết nối việc gắn thẻ fetch SSR vào root layout của bạn — một cách không phá hoại.',
      },
      apiEnv: {
        title: 'Trỏ các lời gọi API phía máy chủ về proxy',
        noteStart: 'Điều duy nhất',
        noteEnd:
          "không thể đoán: biến env nào chứa base URL API của bạn. Trỏ nó về proxy khi recorder được bật, về backend thật trong trường hợp còn lại — proxy không bao giờ chạy trong production.",
        ssrStart: 'Trên Next.js,',
        ssrAfterInit: 'cũng thêm',
        ssrAfterFn: 'vào root layout của bạn để gắn thẻ cho các lời gọi',
        ssrEnd: 'phía máy chủ — một no-op trong production.',
        browserOnly:
          'Ứng dụng chỉ chạy trên trình duyệt? Bỏ qua bước này trừ khi ứng dụng mở WebSocket, vì WebSocket chỉ được ghi lại khi chúng kết nối tới địa chỉ của proxy.',
      },
      record: {
        title: 'Ghi lại, commit, phát lại',
        noteStart: 'Đặt',
        noteMid: ', chạy một lần dựa trên API thật, rồi lật sang',
        noteEnd:
          "và commit. Các bản ghi nằm trong git — đó là điều làm CI tất định. Đừng gitignore chúng.",
      },
    },
    guideLink: 'Hướng dẫn thiết lập đầy đủ\u00a0→',
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
