import type { LegalSection } from '@/lib/legal/terms-and-conditions';

export type CookiePolicyDocument = {
  lastUpdated: string;
  intro: string;
  sections: readonly LegalSection[];
};

export const cookiePolicy: Record<'pt' | 'en', CookiePolicyDocument> = {
  pt: {
    lastUpdated: '25 de outubro de 2026',
    intro:
      'Esta Política de Cookies explica que tecnologias são utilizadas na Silentra for Barbers, para que servem, quando são ativadas e como podes gerir ou retirar o consentimento.',
    sections: [
      {
        title: '1. O que são cookies e tecnologias semelhantes',
        paragraphs: [
          'Cookies são pequenos ficheiros ou identificadores guardados no dispositivo ou navegador. A Plataforma também pode usar mecanismos semelhantes, incluindo scripts de terceiros e tecnologias de medição, para funções essenciais, estatísticas ou marketing.',
          'A Silentra utiliza categorias distintas: necessárias, estatísticas/desempenho e marketing. As tecnologias opcionais não são ativadas até existir uma escolha afirmativa do utilizador.',
        ],
      },
      {
        title: '2. Tecnologias estritamente necessárias',
        paragraphs: [
          'Estas tecnologias permitem prestar funcionalidades pedidas, manter a sessão e autenticação, proteger a plataforma, recordar o idioma e guardar a escolha de cookies. Permanecem ativas mesmo quando rejeitas as categorias opcionais.',
          'O cookie «silentra_cookie_consent» regista a versão do consentimento, as categorias selecionadas e a data/hora da escolha. A duração configurada é de 180 dias. Se o valor estiver inválido ou corresponder a uma versão desconhecida, as tecnologias opcionais permanecem desativadas.',
          'Os mecanismos de sessão e autenticação podem ter a sua própria duração, controlada pelo serviço de autenticação e pelas definições da conta. O cookie de idioma «locale», quando utilizado, ajuda a apresentar a interface no idioma escolhido.',
        ],
      },
      {
        title: '3. Estatísticas e desempenho',
        paragraphs: [
          'Se autorizares esta categoria, a Silentra pode ativar Vercel Analytics e Vercel Speed Insights para compreender padrões de utilização, medir o desempenho e identificar problemas técnicos. Estes serviços podem tratar informação técnica do navegador, páginas consultadas, dados do pedido e métricas de desempenho.',
          'A categoria de estatísticas é opcional. Se não a autorizares, estes componentes não são renderizados pelo servidor. O tratamento exato e os identificadores utilizados por cada fornecedor dependem da versão do serviço e das respetivas definições.',
        ],
      },
      {
        title: '4. Marketing e gestão de etiquetas',
        paragraphs: [
          'Se autorizares marketing, a Plataforma pode carregar o pixel Whop, utilizado para medição de campanhas e eventos associados ao serviço. Este fornecedor pode receber dados técnicos de navegação necessários ao funcionamento do pixel.',
          'O Google Tag Manager pode executar etiquetas de diferentes finalidades. Para evitar que o contentor seja carregado com apenas uma categoria autorizada, a Silentra só o carrega quando autorizas simultaneamente estatísticas e marketing. A configuração do contentor deve ser revista antes de serem publicadas novas etiquetas.',
          'As etiquetas de terceiros podem criar ou ler identificadores próprios. A lista exata e o prazo de validade desses identificadores dependem das etiquetas efetivamente ativas no contentor e das definições de cada fornecedor, pelo que não existe uma duração única controlada pela Silentra para todos eles.',
        ],
      },
      {
        title: '5. Resumo das categorias e duração',
        paragraphs: [
          'Necessárias — sessão, autenticação, segurança, idioma e preferências; ficam ativas para prestar o serviço. «silentra_cookie_consent» tem uma duração configurada de 180 dias; a duração dos mecanismos de autenticação depende da sessão e do fornecedor.',
          'Estatísticas — Vercel Analytics e Vercel Speed Insights; ativadas apenas após autorização. A duração dos eventuais identificadores é determinada pelo fornecedor e pela configuração ativa.',
          'Marketing — pixel Whop; ativado apenas após autorização. Google Tag Manager só é ativado quando estatísticas e marketing estão ambos autorizados, pois o contentor pode conter etiquetas de diferentes finalidades.',
        ],
      },
      {
        title: '6. Como gerir ou retirar o consentimento',
        paragraphs: [
          'Na primeira visita, podes aceitar todas as categorias opcionais, rejeitá-las ou abrir a configuração para escolher separadamente estatísticas e marketing. Nenhuma categoria opcional está pré-selecionada.',
          'Depois de guardares a tua escolha, o atalho «Preferências de cookies» permanece disponível no canto inferior esquerdo. Podes alterar a escolha a qualquer momento; a página é recarregada para aplicar a nova preferência e impedir o carregamento subsequente das categorias não autorizadas.',
          'Retirar o consentimento não afeta a licitude do tratamento efetuado antes da retirada. A eliminação imediata de cookies de terceiros já colocados pode depender do domínio e dos mecanismos do fornecedor; o bloqueio de carregamento impede a sua ativação em visitas posteriores quando a categoria deixa de estar autorizada.',
        ],
      },
      {
        title: '7. Responsável, direitos e contacto',
        paragraphs: [
          'O tratamento associado às funcionalidades da Silentra é realizado de acordo com a Política de Privacidade. Dependendo da operação, podes exercer direitos de acesso, retificação, apagamento, limitação, oposição e portabilidade, ou retirar consentimento quando o tratamento se baseie nele.',
          'Para questões sobre cookies, consentimento ou privacidade, contacta silentra.contact@gmail.com. Também podes apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD).',
          'Esta política pode ser atualizada quando as tecnologias utilizadas ou os requisitos legais mudarem. A data da última atualização é apresentada no início da página.',
        ],
      },
    ],
  },
  en: {
    lastUpdated: 'October 25, 2026',
    intro:
      'This Cookie Policy explains which technologies are used by Silentra for Barbers, why they are used, when they are activated, and how you can manage or withdraw consent.',
    sections: [
      {
        title: '1. What cookies and similar technologies are',
        paragraphs: [
          'Cookies are small files or identifiers stored on a device or browser. The Platform may also use similar mechanisms, including third-party scripts and measurement technologies, for essential functionality, analytics, or marketing.',
          'Silentra uses separate categories: necessary, analytics/performance, and marketing. Optional technologies are not activated until the visitor makes an affirmative choice.',
        ],
      },
      {
        title: '2. Strictly necessary technologies',
        paragraphs: [
          'These technologies allow us to provide requested features, maintain session and authentication, protect the Platform, remember language, and store the cookie choice. They remain active even when you reject optional categories.',
          'The «silentra_cookie_consent» cookie records the consent version, selected categories, and date/time of the choice. Its configured lifetime is 180 days. If the value is invalid or from an unknown version, optional technologies remain disabled.',
          'Session and authentication mechanisms may have their own lifetime, controlled by the authentication service and account settings. The «locale» language cookie, when used, helps display the interface in your selected language.',
        ],
      },
      {
        title: '3. Analytics and performance',
        paragraphs: [
          'If you authorize this category, Silentra may activate Vercel Analytics and Vercel Speed Insights to understand usage patterns, measure performance, and identify technical issues. These services may process technical browser information, viewed pages, request data, and performance metrics.',
          'Analytics is optional. If you do not authorize it, these components are not rendered by the server. Exact processing and identifiers used by each provider depend on the service version and its settings.',
        ],
      },
      {
        title: '4. Marketing and tag management',
        paragraphs: [
          'If you authorize marketing, the Platform may load the Whop pixel, which is used to measure campaigns and events associated with the service. This provider may receive technical browsing data required for the pixel to operate.',
          'Google Tag Manager can run tags for different purposes. To avoid loading the container with only one category authorized, Silentra loads it only when you authorize both analytics and marketing. The container configuration should be reviewed before new tags are published.',
          'Third-party tags may create or read their own identifiers. The exact list and lifetime of those identifiers depend on the tags actually active in the container and each provider’s settings, so there is no single lifetime controlled by Silentra for all of them.',
        ],
      },
      {
        title: '5. Category and lifetime summary',
        paragraphs: [
          'Necessary — session, authentication, security, language, and preferences; remain active to provide the service. «silentra_cookie_consent» has a configured lifetime of 180 days; authentication mechanisms depend on the session and provider.',
          'Analytics — Vercel Analytics and Vercel Speed Insights; activated only after consent. Any identifiers’ lifetime is set by the provider and active configuration.',
          'Marketing — Whop pixel; activated only after consent. Google Tag Manager is activated only when analytics and marketing are both authorized because the container may include tags for different purposes.',
        ],
      },
      {
        title: '6. Managing or withdrawing consent',
        paragraphs: [
          'On your first visit, you can accept all optional categories, reject them, or open settings and choose analytics and marketing separately. No optional category is pre-selected.',
          'After you save your choice, the banner disappears. You can change your choice from the «Cookie preferences» shortcut on this Cookie Policy page; the page reloads to apply the new preference and prevent subsequent loading of unauthorized categories.',
          'Withdrawal does not affect the lawfulness of processing before withdrawal. Immediate removal of third-party cookies already placed may depend on the domain and provider mechanisms; blocking loading prevents activation on future visits when a category is no longer authorized.',
        ],
      },
      {
        title: '7. Controller, rights, and contact',
        paragraphs: [
          'Processing associated with Silentra features follows the Privacy Policy. Depending on the operation, you may exercise rights of access, rectification, erasure, restriction, objection, and portability, or withdraw consent where processing is based on consent.',
          'For questions about cookies, consent, or privacy, contact silentra.contact@gmail.com. You may also lodge a complaint with the Portuguese Data Protection Authority (CNPD).',
          'This policy may be updated when the technologies used or legal requirements change. The last-update date is shown at the top of the page.',
        ],
      },
    ],
  },
};
