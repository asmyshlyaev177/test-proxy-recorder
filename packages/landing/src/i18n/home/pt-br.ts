// Portuguese (Brazil) (pt-BR) homepage copy.
//
// Values only: every key, its order and its type come from en.ts, and a
// missing or renamed one is a type error rather than a silently English
// page. Do not add keys here that en.ts does not have.
// i18n:meta locale=pt-BR source=en.ts source-blob=0e5944e1211d8ba9dcc934fd3c041fc41e109d01 status=translated
import type { HomeCopy } from './types';

export const home: HomeCopy = {
  meta: {
    title: 'VCR para Playwright — grave, reproduza | test-proxy-recorder',
    description:
      'Gravar e reproduzir no estilo VCR para Playwright. Capture respostas reais uma vez e reproduza-as na CI — sem backend, sem mocks à mão. Proxy SSR + HAR, WebSockets. MIT.',
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
  },

  hero: {
    eyebrow: 'VCR para Playwright',
    headlineTop: 'Grave uma vez.',
    headlineBottom: 'Reproduza para sempre.',
    sub: 'Captura respostas reais da API enquanto sua suite do Playwright roda localmente e depois as reproduz byte por byte na CI. Sem backend, sem rede, sem mocks escritos à mão para manter.',
    copyLabel: 'Copiar',
    starCta: 'Estrelar no GitHub',
    starCountAlt: 'Contagem de estrelas do GitHub',
    fine: 'MIT · TypeScript · funciona com SSR de Next.js e TanStack Start, SPAs e extensões do Chrome · suporte a WebSocket',
  },

  demo: {
    heading: 'Veja gravar e depois reproduzir',
    sub: 'Uma execução do Playwright grava respostas reais no disco; mude para reproduzir e a mesma suite passa com o backend desligado — sem rede.',
    videoLabel:
      'Gravação de tela: gravando respostas reais da API com o test-proxy-recorder e depois reproduzindo-as com o backend desligado.',
  },

  mechanisms: {
    heading: 'Dois gravadores, um proxy',
    sub: 'As requisições se originam em dois lugares, então há dois mecanismos de gravação. Use um ou outro — ou ambos juntos. Ambos gravam uma vez e reproduzem a partir do disco, então a CI roda com o backend desligado e sem mocks escritos à mão.',
    proxy: {
      title: 'Proxy',
      flow: 'SSR de Next.js / TanStack Start → proxy → API real',
      body: 'Fica entre o seu servidor e a API. Grava requisições do lado do servidor — fetches SSR, route handlers, tudo o que seu backend-for-frontend chama.',
      when: 'Para aplicações full-stack onde o servidor chama a API.',
      exampleNextjs: 'Ver o exemplo de Next.js →',
      exampleTanstack: 'Ver o exemplo de TanStack Start →',
    },
    har: {
      title: 'HAR',
      flow: 'navegador → interceptação HAR → API real',
      bodyStart: 'Intercepta no próprio navegador. Grava chamadas',
      bodyEnd:
        'do lado do cliente, tráfego de API de extensões do Chrome, analytics e APIs de terceiros.',
      when: 'Para SPAs, extensões e aplicações somente de navegador.',
      exampleExtension: 'Ver o exemplo de extensão do Chrome →',
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
      'O Polly.js intercepta o HTTP do Node, então mockar SSR é possível dentro do processo da aplicação, mas não como parte de uma execução do Playwright. O MSW e o Mocky Balboa também reproduzem respostas reais — mas você escreve os mocks à mão. Quando optar por outra ferramenta é explicado na',
    footLinkLabel: 'documentação',
    footEnd: '.',
  },

  auth: {
    heading: 'Funciona com o seu provedor de autenticação real',
    sub: 'Faça login via Cognito, Auth0, Clerk ou WorkOS — de verdade, em cada execução. Somente a API da sua aplicação é gravada; a autenticação permanece ao vivo e seus dados ficam offline.',
    links: {
      cognito: 'Exemplo de AWS Cognito →',
      tanstack: 'Cognito no TanStack Start →',
      mock: 'Auth simulada (sem conta na nuvem) →',
    },
  },

  quickStart: {
    heading: 'Configure em três passos',
    subStart:
      'Gere tudo com um comando, aponte sua API para o proxy, depois grave e faça commit. Aplicação somente de navegador?',
    subEnd: 'pula a etapa de SSR para você.',
    ai: {
      heading: 'Caminho mais rápido: entregue ao seu agente de IA',
      noteStart:
        'Copie isto, troque pela URL do seu backend e cole no Claude Code, Cursor ou em qualquer agente de codificação — ele executa',
      noteMid: 'e conclui a configuração a partir do prompt que',
      noteEnd: 'imprime.',
      copyLabel: 'Copiar',
    },
    manualIntro: 'Ou configure à mão:',
    steps: {
      install: {
        title: 'Instale e gere',
        noteStart:
          'escreve a config do proxy, uma fixture do Playwright, um teardown global e os scripts de',
        noteEnd:
          'e (no Next.js) conecta a marcação das buscas SSR ao seu root layout — de forma não destrutiva.',
      },
      apiEnv: {
        title: 'Aponte a API da sua aplicação para o proxy',
        noteStart: 'A única coisa que o',
        noteEnd:
          'não consegue adivinhar: qual variável de ambiente guarda a URL base da sua API. Aponte-a para o proxy quando o recorder estiver habilitado e para o backend real caso contrário — o proxy nunca roda em produção.',
        ssrStart: 'No Next.js, o',
        ssrAfterInit: 'também adiciona',
        ssrAfterFn: 'ao seu root layout para marcar as chamadas',
        ssrEnd: 'do lado do servidor — um no-op em produção:',
      },
      record: {
        title: 'Grave, faça commit, reproduza',
        noteStart: 'Defina',
        noteMid: ', execute uma vez contra a API real, depois mude para',
        noteEnd:
          'e faça commit. As gravações vivem no git — é isso que torna a CI determinística. Não as coloque no .gitignore.',
      },
    },
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
