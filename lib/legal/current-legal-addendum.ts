export type LegalLocale = 'pt' | 'en';

export const CURRENT_LEGAL_UPDATE = '25 de outubro de 2026';

export const currentTermsAddendum = {
  pt: {
    title: '15. Oferta promocional, dados e faturação — 25 de outubro de 2026',
    paragraphs: [
      'A Silentra disponibiliza, para novos membros elegíveis que subscrevam o plano Barbers Pro através do checkout aplicável, uma oferta promocional de um mês associada ao código promocional TRIALPRO. A oferta está sujeita à elegibilidade verificada pela Plataforma e às condições configuradas na Stripe.',
      'A oferta TRIALPRO não constitui um período experimental universal nem é garantida para contas que já tenham tido uma subscrição, uma oferta promocional ou outro histórico de faturação que as torne inelegíveis. A Silentra pode impedir a aplicação da oferta quando a conta ou a utilização anterior indicar que as condições de novos membros não são cumpridas.',
      'Quando a oferta for aplicada, o primeiro período elegível será descontado de acordo com a promoção ativa na Stripe. Depois do período promocional, a subscrição será renovada e faturada pelo preço normal e pela periodicidade apresentada no checkout, salvo cancelamento ou alteração da subscrição antes da cobrança aplicável.',
      'A aplicação do código promocional é controlada server-side e pela Stripe. A apresentação do código numa página, anúncio ou mensagem promocional não garante, por si só, a aplicação do desconto se a promoção tiver expirado, sido desativada, atingido os respetivos limites ou se a conta não cumprir os critérios de elegibilidade.',
      'O utilizador deve rever o total, o desconto, a periodicidade e as condições apresentadas no checkout antes de confirmar a subscrição. Em caso de conflito entre uma mensagem promocional e o valor final confirmado no checkout, prevalecem as condições e valores efetivamente apresentados no checkout e registados pelo processador de pagamentos, sem prejuízo dos direitos legais aplicáveis.',
      'As funcionalidades podem incluir reservas públicas, gestão de clientes, agenda, profissionais, fidelização, emails, analytics, automações e outras ferramentas disponibilizadas no plano. Os limites e a disponibilidade podem variar por plano, configuração e estado da conta.',
      'A utilização de cookies não essenciais, identificadores de publicidade ou tecnologias de análise depende da escolha prévia do utilizador sempre que exigido por lei. A recusa não deve impedir o acesso às funcionalidades essenciais.',
      'As preferências são guardadas durante um período limitado e podem ser alteradas ou retiradas através do atalho de preferências de cookies. A retirada do consentimento não afeta a licitude do tratamento efetuado antes da retirada.',
    ],
  },
  en: {
    title: '15. Promotional offer, data, and billing — October 25, 2026',
    paragraphs: [
      'Silentra provides eligible new members who subscribe to the Barbers Pro plan through the applicable checkout with a one-month promotional offer associated with the TRIALPRO promotion code. The offer is subject to eligibility verified by the Platform and the conditions configured in Stripe.',
      'The TRIALPRO offer is not a universal trial and is not guaranteed for accounts that have previously had a subscription, promotional offer, or other billing history that makes them ineligible. Silentra may prevent the offer from being applied when account or prior-use information indicates that the new-member conditions are not met.',
      'When the offer applies, the eligible first period will be discounted according to the active Stripe promotion. After the promotional period, the subscription will renew and be charged at the normal price and billing interval shown at checkout unless the subscription is canceled or changed before the applicable charge.',
      'Promotion-code application is controlled server-side and by Stripe. Displaying the code on a promotional page, advertisement, or message does not by itself guarantee the discount if the promotion has expired, been disabled, reached its limits, or the account does not meet the eligibility criteria.',
      'Users should review the total, discount, billing interval, and terms shown at checkout before confirming a subscription. If a promotional message conflicts with the final checkout amount, the conditions and values actually presented at checkout and recorded by the payment processor prevail, subject to mandatory legal rights.',
      'Features may include public bookings, customer management, scheduling, professionals, loyalty, email, analytics, automations, and other tools made available under the applicable plan. Limits and availability may vary by plan, configuration, and account state.',
      'Use of non-essential cookies, advertising identifiers, or analytics technologies depends on the user’s prior choice wherever required by law. Refusing them must not prevent access to essential features.',
      'Preferences are stored for a limited period and can be changed or withdrawn using the preference control on the Cookie Policy page. Withdrawal does not affect the lawfulness of processing carried out before withdrawal.',
    ],
  },
} as const;

export const currentPrivacyAddendum = {
  pt: {
    title: '15. Atualização do tratamento — 25 de outubro de 2026',
    paragraphs: [
      'Data de nascimento: o campo pode ser recolhido no processo de reserva e armazenado na marcação até existir uma necessidade operacional de o associar ao perfil de cliente da barbearia. A barbearia deve limitar a utilização deste dado ao necessário e assegurar uma base legal adequada.',
      'Localização: quando o cliente autoriza a localização do dispositivo, a Silentra pode utilizar latitude, longitude e informação de precisão para apresentar o mapa, ordenar resultados por distância e melhorar a pesquisa. A localização do cliente não é necessária para navegar no marketplace e, por defeito, é utilizada apenas no contexto da experiência em que foi autorizada.',
      'CRM de clientes: utilizadores autorizados da barbearia podem transformar dados de uma marcação concluída num registo de cliente. O acesso é limitado à barbearia correspondente através de controlos de tenant e permissões server-side.',
      'Billing promocional: a Silentra pode tratar identificadores de promoção, estado de elegibilidade, informação da subscrição e dados de faturação necessários para determinar se uma conta pode beneficiar de uma oferta de novos membros, incluindo a promoção TRIALPRO. Estes dados são utilizados para aplicar a oferta, prevenir reutilização indevida, manter o estado de faturação e cumprir obrigações legais e de auditoria.',
      'Stripe: a aplicação do desconto e a confirmação do estado da cobrança dependem do processador de pagamentos Stripe. A Silentra pode conservar os identificadores técnicos necessários para reconciliar a promoção e a subscrição sem armazenar os dados completos do cartão.',
      'Email e notificações: a plataforma pode tratar endereços de email e dados técnicos necessários para enviar confirmações de reserva, mensagens operacionais, códigos de acesso e outras comunicações configuradas. O envio de comunicações comerciais deve respeitar a base legal e as preferências aplicáveis.',
      'Cookies e analytics: podem ser utilizados identificadores estritamente necessários para sessão, segurança e funcionamento. Quando sejam usados mecanismos opcionais de medição ou tecnologias que exijam consentimento, esse tratamento deve respeitar as preferências de consentimento configuradas pelo utilizador e a legislação aplicável.',
      'Segurança e minimização: as políticas de acesso procuram aplicar segregação por barbearia, menor privilégio e validação no servidor. Estes controlos destinam-se a apoiar os princípios de minimização, limitação das finalidades, integridade e confidencialidade previstos no RGPD.',
      'O banner de consentimento permite aceitar todas as categorias opcionais, rejeitar as opcionais ou configurar separadamente estatísticas e marketing. As tecnologias não essenciais permanecem desativadas até existir uma escolha válida. A preferência é guardada num cookie próprio, com duração limitada, e pode ser alterada através do atalho de preferências ou da página Política de Cookies.',
      'O Google Tag Manager pode executar etiquetas de terceiros e, por isso, só é carregado quando as categorias de consentimento necessárias estão autorizadas. O pixel Whop depende da autorização de marketing; Vercel Analytics e Speed Insights dependem da autorização de estatísticas. A configuração de etiquetas no Google Tag Manager deve respeitar estas categorias e não pode contornar as preferências registadas.',
    ],
  },
  en: {
    title: '15. Processing update — October 25, 2026',
    paragraphs: [
      "Date of birth: the field may be collected during booking and stored on the appointment until there is an operational need to associate it with the barbershop's customer profile. The barbershop should limit use of this data to what is necessary and maintain an appropriate lawful basis.",
      'Location: when a customer authorizes device location, Silentra may use latitude, longitude, and accuracy information to display maps, sort results by distance, and improve search. Customer location is not required to browse the marketplace and, by default, is used only in the experience for which it was authorized.',
      'Customer CRM: authorized barbershop users may turn data from a completed appointment into a customer record. Access is limited to the relevant barbershop through tenant controls and server-side authorization.',
      'Promotional billing: Silentra may process promotion identifiers, eligibility state, subscription information, and billing data required to determine whether an account may benefit from a new-member offer, including TRIALPRO. This data is used to apply the offer, prevent misuse or repeated redemption, maintain billing state, and meet legal and audit obligations.',
      'Stripe: discount application and billing-state confirmation depend on the Stripe payment processor. Silentra may retain the technical identifiers needed to reconcile the promotion and subscription without storing complete card details.',
      'Email and notifications: the platform may process email addresses and technical data needed to send booking confirmations, operational messages, access codes, and other configured communications. Commercial communications must be supported by an appropriate lawful basis and respect applicable preferences.',
      "Cookies and analytics: strictly necessary identifiers may be used for sessions, security, and essential operation. Where optional measurement tools or technologies requiring consent are used, processing should respect the user's configured consent preferences and applicable law.",
      'Security and minimization: access policies aim to apply barbershop-level segregation, least privilege, and server-side validation. These controls are intended to support GDPR principles of data minimization, purpose limitation, integrity, and confidentiality.',
      'The consent banner lets visitors accept all optional categories, reject optional categories, or configure analytics and marketing separately. Non-essential technologies remain disabled until a valid choice is recorded. The preference is stored in a first-party cookie for a limited period and can be changed using the preference control on the Cookie Policy page.',
      'Google Tag Manager can execute third-party tags and is therefore loaded only when the required consent categories are enabled. The Whop pixel depends on marketing consent; Vercel Analytics and Speed Insights depend on analytics consent. Tags configured in Google Tag Manager must respect these categories and must not bypass recorded preferences.',
    ],
  },
} as const;


export const currentTermsFeatureSections = {
  pt: [
    {
      title: '16. Sites próprios e API pública — 25 de outubro de 2026',
      paragraphs: [
        'A Plataforma pode disponibilizar páginas públicas para barbearias e um serviço de site próprio, sujeito ao plano, elegibilidade, aprovação do pedido, configuração e condições comerciais apresentadas. A publicação pode depender de revisão e atribuição de um endereço público.',
        'A barbearia é responsável por garantir que tem direitos para usar textos, imagens, marcas, testemunhos, preços e outros conteúdos que fornece, e por manter os seus dados públicos corretos e atualizados. Deve incluir no seu site as informações legais, comerciais e de contacto que lhe sejam aplicáveis.',
        'A API pública v1 disponibiliza apenas os campos definidos na documentação, em modo de consulta. A API pode aplicar limites de utilização, cache, versões e medidas de segurança; não existe garantia de disponibilidade ininterrupta nem de que todos os dados sejam atualizados em tempo real.',
        'Quem consome a API deve respeitar a documentação, os direitos de propriedade intelectual, a legislação de proteção de dados e os limites técnicos. Não pode tentar contornar limites, aceder a dados privados, reidentificar pessoas, realizar recolha abusiva ou apresentar dados públicos de forma enganadora.',
      ],
    },
    {
      title: '17. Reservas automáticas e mensagens de aniversário — 25 de outubro de 2026',
      paragraphs: [
        'Quando a funcionalidade estiver disponível no plano e for ativada por uma pessoa autorizada da barbearia, novas marcações podem ser confirmadas automaticamente em vez de aguardarem confirmação manual. A conclusão automática pode alterar para «concluída» uma marcação agendada depois de terminar a duração registada, através de processamento periódico.',
        'A barbearia deve configurar estas opções de forma adequada à sua operação, monitorizar a agenda e informar os clientes sobre o processo de marcação. Continua responsável por resolver conflitos, corrigir dados incorretos e prestar o serviço reservado. A execução automática depende da configuração, da disponibilidade técnica e da informação registada.',
        'As automações de aniversário podem usar a data de nascimento e os dados de contacto dos clientes para preparar ou enviar mensagens por email ou por outros canais disponíveis. A barbearia é responsável por determinar a base legal, recolher consentimento quando exigido, respeitar oposições e preferências de comunicação e garantir que o conteúdo e a frequência são adequados.',
        'A Silentra fornece ferramentas técnicas para configurar e executar estas ações; não garante a entrega por fornecedores de comunicação, nem substitui as responsabilidades legais da barbearia relativamente aos seus clientes.',
      ],
    },
    {
      title: '18. Cookies e tecnologias de medição — 25 de outubro de 2026',
      paragraphs: [
        'A Plataforma utiliza tecnologias estritamente necessárias para autenticação, segurança, idioma e memorização da escolha de cookies. As tecnologias opcionais de estatísticas e marketing só são carregadas conforme as categorias escolhidas no painel de preferências.',
        'A escolha fica registada no cookie «silentra_cookie_consent» durante 180 dias. O Google Tag Manager só é carregado quando as categorias de estatísticas e marketing estão ambas autorizadas; o pixel Whop depende da autorização de marketing e Vercel Analytics/Speed Insights dependem da autorização de estatísticas.',
        'Podes aceitar, rejeitar as categorias opcionais ou selecionar preferências individualmente. Depois de guardar a escolha, o banner desaparece; podes alterar as preferências através do controlo disponível na página da Política de Cookies. A recusa de tecnologias opcionais não impede o acesso às funcionalidades que não dependam delas.',
      ],
    },
  ],
  en: [
    {
      title: '16. Custom websites and public API — October 25, 2026',
      paragraphs: [
        'The Platform may provide public barbershop pages and a custom-website service, subject to plan, eligibility, request approval, configuration, and the commercial terms presented. Publication may require review and assignment of a public address.',
        'The barbershop is responsible for ensuring it has the rights to use the text, images, trademarks, testimonials, prices, and other content it supplies, and for keeping public information accurate and current. It must include the legal, commercial, and contact information applicable to its own website.',
        'The public API v1 exposes only the fields defined in the documentation, on a read-only basis. It may apply usage limits, caching, versioning, and security controls; uninterrupted availability and real-time updates are not guaranteed.',
        'API consumers must follow the documentation, intellectual-property rights, data-protection law, and technical limits. They may not bypass limits, access private data, re-identify individuals, perform abusive collection, or present public data misleadingly.',
      ],
    },
    {
      title: '17. Automated bookings and birthday messages — October 25, 2026',
      paragraphs: [
        'When available under the plan and enabled by an authorized barbershop user, new bookings may be confirmed automatically instead of waiting for manual confirmation. Automatic completion may change a scheduled booking to «completed» after its recorded duration has ended, through periodic processing.',
        'The barbershop must configure these options appropriately, monitor its schedule, and inform customers about the booking process. It remains responsible for resolving conflicts, correcting inaccurate details, and delivering the booked service. Automated processing depends on configuration, technical availability, and stored data.',
        'Birthday automations may use customer birth dates and contact details to prepare or send messages by email or other available channels. The barbershop is responsible for determining the lawful basis, obtaining consent where required, respecting objections and communication preferences, and ensuring appropriate content and frequency.',
        'Silentra supplies technical tools to configure and run these actions; it does not guarantee delivery by communication providers and does not replace the barbershop’s legal responsibilities towards customers.',
      ],
    },
    {
      title: '18. Cookies and measurement technologies — October 25, 2026',
      paragraphs: [
        'The Platform uses strictly necessary technologies for authentication, security, language, and remembering the cookie choice. Optional analytics and marketing technologies are loaded only according to the categories selected in the preference panel.',
        'The choice is stored in the «silentra_cookie_consent» cookie for 180 days. Google Tag Manager loads only when both analytics and marketing are authorized; the Whop pixel depends on marketing consent and Vercel Analytics/Speed Insights depend on analytics consent.',
        'You may accept, reject optional categories, or choose individual preferences, and change your choice at any time using the preference controls on the Cookie Policy page. Rejecting optional technologies does not prevent access to features that do not depend on them.',
      ],
    },
  ],
} as const;

export const currentPrivacyFeatureSections = {
  pt: [
    {
      title: '16. Cookies, consentimento e tecnologias de terceiros — 25 de outubro de 2026',
      paragraphs: [
        'O cookie «silentra_cookie_consent» guarda a versão da política de consentimento, as categorias escolhidas e a data/hora da escolha durante 180 dias. É utilizado para respeitar e recordar as tuas preferências. Se o valor for inválido ou corresponder a uma versão desconhecida, as tecnologias opcionais ficam desativadas até ser feita uma nova escolha.',
        'Os cookies e mecanismos estritamente necessários podem suportar autenticação e sessão, segurança, idioma e funcionalidades solicitadas. Não são usados para ativar marketing opcional. A sua duração pode depender da sessão, do mecanismo de autenticação ou da preferência que servem.',
        'Quando autorizadas, as estatísticas podem incluir Vercel Analytics e Speed Insights para medir a utilização e o desempenho da plataforma. Quando autorizas marketing, pode ser carregado o pixel Whop. O Google Tag Manager, por poder executar etiquetas de diferentes finalidades, só é carregado quando autorizas simultaneamente estatísticas e marketing.',
        'As etiquetas de terceiros podem utilizar identificadores ou tecnologias de armazenamento próprias, conforme a configuração ativa do serviço externo. A lista exata e a duração desses identificadores podem variar consoante as etiquetas efetivamente publicadas no contentor Google Tag Manager e as definições dos fornecedores; estas configurações devem ser revistas antes de novas etiquetas serem ativadas.',
        'Podes alterar ou retirar o consentimento a qualquer momento através do controlo disponível na página da Política de Cookies. Ao guardar uma nova escolha, a página é recarregada para aplicar a preferência no servidor e impedir o carregamento subsequente de categorias não autorizadas. Retirar consentimento não afeta a licitude do tratamento anterior à retirada.',
      ],
    },
    {
      title: '17. Reservas, automações e mensagens de aniversário — 25 de outubro de 2026',
      paragraphs: [
        'A plataforma pode tratar estados e horários de marcações para confirmar automaticamente novas reservas, quando a opção se encontra ativa, e para concluir marcações agendadas depois de terminar a duração registada, quando a conclusão automática está ativada. Estas operações servem a gestão da agenda e podem atualizar o estado operacional da marcação.',
        'As campanhas de aniversário podem tratar a data de nascimento, nome, email ou telefone do cliente para enviar uma mensagem no dia correspondente ou num dia relativo configurado, e podem registar o resultado de envio e um identificador de destinatário. A barbearia configura a campanha e determina a finalidade e a base legal do tratamento dos dados dos seus clientes.',
        'A barbearia deve confirmar que tem uma base legal adequada para as mensagens de aniversário e para cada canal utilizado, obter consentimento quando exigido, disponibilizar informação aos clientes, respeitar oposições e pedidos de não contacto e manter os dados corretos. A data de nascimento não deve ser utilizada para finalidades incompatíveis com as comunicadas.',
      ],
    },
    {
      title: '18. Sites próprios, API pública e dados publicados — 25 de outubro de 2026',
      paragraphs: [
        'O serviço de sites próprios permite publicar determinados conteúdos de uma barbearia, como nome, texto descritivo, imagem, ligação para marcação e outros campos configurados. A barbearia decide que conteúdo fornece e deve assegurar que tem autorização para o publicar, incluindo dados, fotografias e testemunhos que possam identificar terceiros.',
        'A API pública v1 fornece dados previamente definidos e destinados à publicação, como perfil público, serviços, horários, avaliações e ligações públicas, dentro dos limites documentados. Não foi concebida para devolver credenciais, dados de sessão, contactos privados ou o conteúdo interno de contas.',
        'Os pedidos à API podem gerar registos técnicos de segurança e utilização, incluindo rota, código de resposta, duração, região e identificador do pedido. A aplicação de limites e cache serve para proteger a disponibilidade e o uso responsável do serviço.',
      ],
    },
    {
      title: '19. Fornecedores, conservação e transferências — 25 de outubro de 2026',
      paragraphs: [
        'Consoante a funcionalidade utilizada e o consentimento dado, podem intervir fornecedores de alojamento e infraestrutura (incluindo Vercel e Supabase), medição (Vercel Analytics/Speed Insights), gestão de etiquetas (Google Tag Manager), medição de marketing (Whop), pagamentos (Stripe) e comunicações por email (Brevo). Cada fornecedor recebe apenas os dados necessários à função técnica que presta, de acordo com a configuração e os contratos aplicáveis.',
        'Alguns fornecedores podem tratar dados fora do Espaço Económico Europeu. Quando tal ocorrer, o tratamento deve assentar num mecanismo de transferência permitido pelo RGPD, como uma decisão de adequação ou garantias apropriadas, conforme aplicável. A localização concreta pode variar de acordo com o serviço e a configuração da conta.',
        'Os dados são conservados durante o tempo necessário à finalidade, à prestação do serviço, à segurança, à resolução de litígios e ao cumprimento de obrigações legais. Os registos de consentimento e faturação podem ser mantidos pelo período necessário para demonstrar escolhas, cumprir obrigações e responder a pedidos ou reclamações.',
      ],
    },
  ],
  en: [
    {
      title: '16. Cookies, consent, and third-party technologies — October 25, 2026',
      paragraphs: [
        'The «silentra_cookie_consent» cookie stores the consent-policy version, selected categories, and date/time of the choice for 180 days. It is used to respect and remember your preferences. If the value is invalid or from an unknown version, optional technologies remain disabled until a new choice is made.',
        'Strictly necessary cookies and mechanisms may support authentication and session management, security, language, and requested features. They are not used to enable optional marketing. Their lifetime may depend on the session, authentication mechanism, or preference they serve.',
        'When authorized, analytics may include Vercel Analytics and Speed Insights to measure platform usage and performance. When marketing is authorized, the Whop pixel may load. Because it can run tags for different purposes, Google Tag Manager is loaded only when you authorize both analytics and marketing.',
        'Third-party tags may use their own identifiers or storage technologies depending on the active configuration of the external service. The exact list and lifetime of those identifiers may vary with the tags actually published in the Google Tag Manager container and vendor settings; those configurations should be reviewed before new tags are activated.',
        'You may change or withdraw consent at any time using the preference control on the Cookie Policy page. Saving a new choice reloads the page so the preference is applied on the server and unauthorized categories are not loaded subsequently. Withdrawal does not affect the lawfulness of processing before withdrawal.',
      ],
    },
    {
      title: '17. Bookings, automations, and birthday messages — October 25, 2026',
      paragraphs: [
        'The platform may process booking statuses and times to automatically confirm new bookings when that option is enabled, and to complete scheduled bookings after their recorded duration has ended when automatic completion is enabled. These operations support schedule management and may update a booking’s operational status.',
        'Birthday campaigns may process a customer’s birth date, name, email, or phone number to send a message on the matching date or a configured relative day, and may record the delivery outcome and recipient identifier. The barbershop configures the campaign and determines the purpose and lawful basis for processing its customers’ data.',
        'The barbershop must confirm an appropriate lawful basis for birthday messages and each channel used, obtain consent where required, inform customers, respect objections and do-not-contact requests, and keep data accurate. Birth dates must not be used for purposes incompatible with those communicated.',
      ],
    },
    {
      title: '18. Custom websites, public API, and published data — October 25, 2026',
      paragraphs: [
        'The custom-website service can publish selected barbershop content such as name, description, image, booking link, and other configured fields. The barbershop decides which content it supplies and must ensure it has permission to publish it, including data, photos, and testimonials that may identify other people.',
        'The public API v1 provides predefined data intended for publication, such as public profile, services, opening hours, reviews, and public links, within the documented limits. It is not designed to return credentials, session data, private contact details, or internal account content.',
        'API requests may generate technical security and usage logs, including route, response code, duration, region, and request identifier. Rate limits and caching help protect availability and responsible use of the service.',
      ],
    },
    {
      title: '19. Providers, retention, and transfers — October 25, 2026',
      paragraphs: [
        'Depending on the feature used and consent granted, providers may include hosting and infrastructure (including Vercel and Supabase), measurement (Vercel Analytics/Speed Insights), tag management (Google Tag Manager), marketing measurement (Whop), payments (Stripe), and email communications (Brevo). Each provider receives only the data needed for its technical function, according to configuration and applicable agreements.',
        'Some providers may process data outside the European Economic Area. Where this occurs, processing must rely on a transfer mechanism permitted under the GDPR, such as an adequacy decision or appropriate safeguards, as applicable. The actual location may vary by service and account configuration.',
        'Data is retained for as long as necessary for its purpose, service delivery, security, dispute resolution, and legal obligations. Consent and billing records may be retained for as long as necessary to demonstrate choices, meet obligations, and respond to requests or complaints.',
      ],
    },
  ],
} as const;
