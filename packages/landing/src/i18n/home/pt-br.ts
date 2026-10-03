// Portuguese (Brazil) (pt-BR) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=pt-BR source=en.ts source-blob=c698d86206f541e55eef9064035f21550ca9a188 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'Grave e reproduza chamadas de API no Playwright, incluindo SSR',
    description:
      'Grave respostas reais da API no Playwright e reproduza-as na CI. Cobre buscas do servidor no Next.js e TanStack Start, chamadas do navegador e WebSockets.',
    ogImageAlt:
      'test-proxy-recorder — record once, replay forever. Diagrama dos modos de gravar e reproduzir.',
  },

  chrome: {
    skipToContent: 'Pular para o conteúdo',
    navQuickStart: 'Início rápido',
    navDocs: 'Documentação',
    updated: 'Atualizado',
    licensed: 'Licenciado sob MIT.',
    languageLabel: 'Idioma',
    copied: 'Copiado',
  },

  hero: {
    title: 'Grave e reproduza chamadas de API em testes do Playwright, incluindo requisições do lado do servidor',
    headlineTop: 'Grave uma vez.',
    headlineBottom: 'Reproduza para sempre.',
    sub: 'Grava as respostas da API que sua aplicação recebe durante uma execução local do Playwright, incluindo WebSockets, e depois as reproduz na CI com o seu backend desligado.',
    copyLabel: 'Copiar',
    starCta: 'Estrelar no GitHub',
    fine: 'MIT · TypeScript · Node ≥ 20 · SSR de Next.js e TanStack Start, SPAs, extensões do Chrome, WebSockets',
    scenePause: 'Pausar',
    scenePlay: 'Continuar',
  },

  demo: {
    heading: 'Veja gravar e depois reproduzir',
    sub: 'Uma execução do Playwright grava respostas reais no disco; mude para reproduzir e a mesma suite passa com o backend desligado.',
    videoLabel:
      'Gravação de tela: gravando respostas reais da API com o test-proxy-recorder e depois reproduzindo-as com o backend desligado.',
  },

  mechanisms: {
    heading: 'Duas formas de gravar',
    sub: 'As requisições se originam em dois lugares, então há duas formas de gravá-las, e o processo do proxy roda em ambas. Tudo o que é enviado ao proxy (buscas do lado do servidor, chamadas do navegador por uma URL base da API compartilhada com o servidor, WebSockets) é reproduzido a partir do .mock.json do teste. As chamadas do navegador para outros hosts que correspondam ao padrão de url da sua fixture são reproduzidas a partir do .har do teste.',
    proxy: {
      title: 'Proxy',
      flow: 'SSR de Next.js / TanStack Start → proxy → API real',
      body: 'Fica entre o seu servidor e a API. Grava requisições do lado do servidor: buscas de Server Components e de SSR, route handlers, tudo o que o seu backend-for-frontend chama.',
      when: 'Para aplicações full-stack onde o servidor chama a API.',
      parallel: 'As requisições do lado do servidor de cada teste carregam o id desse teste, então testes rodando em paralelo nunca compartilham uma gravação.',
      guideNextjs: 'Guia de Next.js →',
      guideTanstack: 'Guia de TanStack Start →',
      exampleNextjs: 'Ver o exemplo de Next.js →',
      exampleTanstack: 'Ver o exemplo de TanStack Start →',
    },
    har: {
      title: 'HAR',
      flow: 'navegador → interceptação HAR → API real',
      bodyStart: 'Intercepta no próprio navegador e salva um arquivo HTTP Archive (HAR). Grava chamadas',
      bodyEnd:
        'do lado do cliente, tráfego de API de extensões do Chrome, analytics e APIs de terceiros, desde que correspondam ao padrão de url da sua fixture.',
      when: 'Para SPAs, extensões e aplicações somente de navegador.',
      proxyNote:
        'Em comparação com o routeFromHAR puro, ele acrescenta um HAR por teste e remove os valores dos headers de autenticação.',
      guidePlaywright: 'Guia de Playwright →',
      exampleExtension: 'Ver o exemplo de extensão do Chrome →',
      exampleVite: 'Ver o exemplo de Vite + WebSocket →',
    },
  },

  compare: {
    heading: 'Onde ele se encaixa',
    sub: 'As ferramentas de mock são boas em trabalhos diferentes. A combinação abaixo — gravar tráfego real em SSR, navegador e WebSockets, sem mocks escritos à mão — é a lacuna que as outras deixam em aberto.',
    tableCaption:
      'Comparação de recursos do test-proxy-recorder com o routeFromHAR do Playwright, MSW, Polly.js, playwright-network-cache e Mocky Balboa.',
    featureLabel: 'Recurso',
    features: [
      'Grava tráfego real',
      'Lado do servidor (SSR)',
      'Lado do navegador',
      'WebSocket',
      'Nativo do Playwright',
      'Mantido',
    ],
    markText: { y: 'Sim', n: 'Não', p: 'Parcial' },
    footStart:
      'O Polly.js grava dentro do processo em que roda, então, para requisições do lado do servidor, ele precisa rodar dentro do servidor da sua aplicação. O MSW e o Mocky Balboa também mockam requisições do lado do servidor, mas você mesmo escreve as respostas. A comparação completa, com fontes e quando escolher outra ferramenta, está na',
    footLinkLabel: 'documentação',
    footEnd: '.',
    tradeoff:
      'A contrapartida é uma primeira configuração mais trabalhosa do que a das ferramentas somente de navegador: um processo de proxy roda ao lado dos seus testes e, para requisições do lado do servidor, a URL base da API da sua aplicação aponta para ele durante as execuções de teste.',
  },

  auth: {
    heading: 'Funciona com o seu provedor de autenticação real',
    sub: 'Faça login via Cognito, Auth0, Clerk ou WorkOS — de verdade, em cada execução. Somente a API da sua aplicação é gravada; a autenticação permanece ao vivo e seus dados ficam offline.',
    links: {
      cognito: 'Exemplo de AWS Cognito →',
      tanstack: 'Cognito no TanStack Start →',
      mock: 'Auth simulada (sem conta na nuvem) →',
    },
  },

  recordingSample: {
    heading: 'Como é uma gravação',
    perTest: {
      term: 'Um arquivo por teste',
      start: 'Cada teste escreve seu próprio arquivo, com o nome do teste, então',
      end: 'grava de novo só esse teste. O proxy grava um teste por vez, então grave com um único worker; a reprodução roda em paralelo.',
    },
    testId: {
      term: 'O id do teste',
      start: 'O Playwright envia',
      mid: 'em cada requisição que um teste faz, e o',
      end: 'o copia para as buscas feitas pelo seu próprio servidor. O proxy o lê para responder a cada teste a partir do próprio arquivo desse teste, mesmo quando os testes são reproduzidos em paralelo.',
    },
    secrets: {
      term: 'Segredos',
      body: 'Os headers Authorization, Cookie e Set-Cookie passam a ser [REDACTED] nos arquivos .mock.json antes de serem salvos, e nos arquivos .har quando a execução termina. Segredos dentro dos corpos de resposta exigem padrões definidos por você.',
      link: 'Remoção de segredos →',
    },
    caption:
      'Parte de uma gravação real, 2.6 KB no total: o POST de um teste, com o valor do header Authorization removido. O arquivo completo também contém o GET que veio em seguida, todos os headers e um timestamp para cada requisição.',
  },

  replayQuestions: {
    heading: 'Perguntas sobre a reprodução',
    matching: {
      term: 'Como é feita a correspondência das requisições?',
      body: 'O proxy faz a correspondência de uma chamada do lado do servidor pelo método, pelo caminho e pela query string exata, não pelo corpo, e serve as chamadas repetidas na ordem em que foram gravadas. As chamadas do navegador seguem as regras de HAR do Playwright, que também comparam os corpos de POST. Uma query string que muda a cada execução, como um timestamp, nunca corresponde, e nenhuma opção ignora um parâmetro, então mantenha esses valores fixos durante os testes.',
      link: 'Correspondência de requisições na reprodução →',
    },
    misses: {
      term: 'E se faltar uma gravação?',
      start:
        'O proxy responde 404 e identifica a requisição e o teste. Uma chamada feita mais vezes do que foi gravada recebe de novo a última resposta, com um aviso no log do proxy. No navegador, o Playwright aborta uma chamada que corresponde ao padrão',
      mid: 'que sua fixture passa para',
      end: 'mas não está no HAR; as outras chamadas chegam à rede.',
    },
    liveApi: {
      term: 'Quando a reprodução chega à API real?',
      start:
        'A reprodução só chega à API real depois que o proxy sai do modo replay, e o proxy mantém um único modo para todos os testes em execução. Ele sai do modo replay 120 segundos depois do início do último teste, ou quando um hook por teste chama',
      end: '. Sem backend rodando na CI, uma chamada assim falha em vez de passar.',
      link: 'Timeout da sessão e teardown →',
    },
    drift: {
      term: 'O que acontece quando a API muda?',
      body: 'Com um cliente de API tipado, atualizar o cliente por causa de um campo alterado faz falhar os testes reproduzidos que o usam, porque as gravações ainda contêm o campo antigo. Isso aponta para a mudança, e gravar de novo corrige os testes com menos trabalho do que editar mocks escritos à mão.',
    },
    overrides: {
      term: 'Como testo erros e casos-limite?',
      start: 'No navegador, um',
      mid: 'registrado depois de',
      end: 'sobrescreve a gravação. As respostas do lado do servidor são editadas no arquivo .mock.json.',
      link: 'Forçar uma resposta →',
    },
  },

  quickStart: {
    heading: 'Início rápido',
    subStart:
      'Gere tudo com um comando, aponte sua API para o proxy, depois grave e faça commit. Aplicação somente de navegador?',
    subEnd: 'pula a etapa de SSR para você.',
    tabs: {
      agent: 'Com seu agente de IA',
      manual: 'À mão',
    },
    ai: {
      noteStart:
        'Cole isto no Claude Code, no Cursor ou em outro agente de codificação. Primeiro ele executa o @tanstack/intent, que adiciona orientações ao arquivo de config do seu agente, como o CLAUDE.md, para que o agente carregue as skills de configuração desta biblioteca. Depois ele instala o pacote, encontra a URL do seu backend na config da aplicação, executa o',
      noteEnd: 'e conclui a configuração a partir da saída desse comando.',
      copyLabel: 'Copiar prompt',
    },
    changes: {
      label: 'O que muda no seu repositório',
      tests:
        'Na sua suite de testes: uma fixture do Playwright, o processo do proxy (ele só roda durante os testes) e gravações commitadas no git.',
      appStart:
        'Na sua aplicação, só para requisições do lado do servidor: aponte a URL base da API para o proxy durante as execuções de teste e chame',
      appEnd:
        'uma vez, em app/layout.tsx no Next.js ou em src/router.tsx no TanStack Start. Ele copia o id do teste para cada busca do lado do servidor e não faz nada em produção, a menos que TEST_PROXY_RECORDER_ENABLED esteja definido.',
      agent:
        'Com o prompt do agente: o @tanstack/intent adiciona ao arquivo de config do seu agente, como o CLAUDE.md, orientações para carregar as skills desta biblioteca.',
      deployed:
        'Testando um ambiente implantado? O HAR grava as chamadas do navegador desse ambiente sem nenhuma mudança na aplicação, mas as próprias páginas continuam sendo carregadas daquele servidor. Para reproduzir também as chamadas do lado do servidor, rode a aplicação na CI ao lado do proxy.',
    },
    steps: {
      install: {
        title: 'Instale e gere',
        noteStart:
          'escreve a config do proxy, uma fixture do Playwright, um teardown global e os scripts de',
        noteEnd:
          'e (no Next.js) conecta a marcação das buscas SSR ao seu root layout — de forma não destrutiva.',
      },
      apiEnv: {
        title: 'Aponte as chamadas de API do lado do servidor para o proxy',
        noteStart: 'A única coisa que o',
        noteEnd:
          'não consegue adivinhar: qual variável de ambiente guarda a URL base da sua API. Aponte-a para o proxy quando o recorder estiver habilitado e para o backend real caso contrário — o proxy nunca roda em produção.',
        ssrStart: 'No Next.js, o',
        ssrAfterInit: 'também adiciona',
        ssrAfterFn: 'ao seu root layout para marcar as chamadas',
        ssrEnd: 'do lado do servidor — um no-op em produção.',
        browserOnly:
          'Aplicação somente de navegador? Pule esta etapa, a menos que a aplicação abra WebSockets, que só são gravados quando se conectam ao endereço do proxy.',
      },
      record: {
        title: 'Grave, faça commit, reproduza',
        noteStart: 'Defina',
        noteMid: ', execute uma vez contra a API real, depois mude para',
        noteEnd:
          'e faça commit. As gravações vivem no git — é isso que torna a CI determinística. Não as coloque no .gitignore.',
      },
    },
    guideLink: 'Guia completo de configuração →',
  },

  cta: {
    heading: 'Pare de escrever mocks à mão',
    sub: 'Sua API já dá as respostas certas. Grave-as.',
    copyLabel: 'Copiar',
    starCta: 'Estrelar no GitHub',
    fineStart:
      'Se isso economizou uma tarde, uma estrela leva um segundo — é assim que a próxima pessoa encontra e diz a um mantenedor solo para continuar construindo. Esbarrou em um problema ou teve uma ideia?',
    issueLabel: 'Abra uma issue',
    fineBetween: 'ou',
    discordLabel: 'entre no Discord',
    fineEnd: '.',
  },
};
