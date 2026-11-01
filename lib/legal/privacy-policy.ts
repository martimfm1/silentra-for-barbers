export type PrivacySection = {
  title: string;
  paragraphs: string[];
};

export type PrivacyDocument = {
  lastUpdated: string;
  intro: string;
  sections: PrivacySection[];
};

export const PRIVACY_LAST_UPDATED = '1 de novembro de 2026';

export const privacyPolicy: Record<'pt' | 'en', PrivacyDocument> = {
  pt: {
    lastUpdated: PRIVACY_LAST_UPDATED,
    intro:
      'Esta Política de Privacidade explica como a Silentra for Barbers (' +
      '«Silentra») trata dados pessoais quando utilizas a plataforma SaaS de gestão de barbearias, o marketplace público, as funcionalidades de reservas, comunicações, analytics e faturação.',
    sections: [
      {
        title: '1. Responsável pelo tratamento e papéis',
        paragraphs: [
          'Para dados da conta, administração da plataforma, faturação, segurança e suporte, a Silentra atua como responsável pelo tratamento, na medida aplicável.',
          'Para dados de clientes finais introduzidos numa reserva ou geridos pela barbearia, a barbearia é normalmente a responsável pelo tratamento e a Silentra atua como prestadora tecnológica/subcontratante, conforme a operação e a legislação aplicável.',
          'A barbearia é responsável por definir as finalidades e por cumprir as suas obrigações de informação, base legal e exercício de direitos relativamente aos dados que introduz na plataforma.',
        ],
      },
      {
        title: '2. Dados que tratamos',
        paragraphs: [
          'Podemos tratar dados de conta e autenticação, incluindo nome, email, telefone, identificadores de conta, função e dados necessários à segurança da sessão.',
          'Podemos tratar dados da barbearia, incluindo nome, contacto, morada, horários, dias de encerramento, serviços, preços, profissionais, comissões e configurações da conta.',
          'Para reservas e gestão de clientes, podemos tratar nome, telefone, email, serviço, profissional, data e hora, estado da marcação, notas e dados introduzidos manualmente pela barbearia ou pelo cliente.',
          'Podemos tratar avaliações, dados de utilização, registos de auditoria, informações técnicas, identificadores de sessão, dados de subscrição e informação necessária para prevenir abuso e manter a segurança.',
          'As notificações push podem utilizar os dados técnicos necessários para manter uma subscrição do dispositivo. O envio push atualmente é usado para notificações operacionais dirigidas aos barbeiros, nomeadamente novos bookings.',
        ],
      },
      {
        title: '3. Faturação e pagamentos',
        paragraphs: [
          'As subscrições e pagamentos podem ser processados através da Stripe. A Silentra mantém identificadores de cliente e subscrição necessários para gerir o estado de faturação, mas não necessita de armazenar diretamente os dados completos do cartão usados no pagamento.',
          'O plano aplicável à conta pode ser free, pro ou enterprise. Funcionalidades, quotas e limites podem variar conforme o plano contratado e podem ser atualizados de acordo com os Termos e as condições comerciais apresentadas no momento da contratação.',
        ],
      },
      {
        title: '4. Comunicações e fornecedores',
        paragraphs: [
          'A Silentra pode utilizar fornecedores especializados para alojamento, base de dados, pagamentos, email, monitorização e infraestrutura técnica. Estes fornecedores apenas recebem os dados necessários para prestar os respetivos serviços.',
          'O envio de email transacional e de mensagens manuais por email pode ser realizado através da Brevo. O nome da barbearia pode ser utilizado como nome do remetente nas mensagens enviadas em seu nome.',
          'O envio manual de SMS encontra-se atualmente desativado. A Silentra não deve ser considerada como estando a enviar SMS através da plataforma enquanto essa funcionalidade permanecer desativada. Se a funcionalidade for ativada no futuro, esta política poderá ser atualizada para refletir o tratamento correspondente.',
        ],
      },
      {
        title: '5. Finalidades e bases legais',
        paragraphs: [
          'Tratamos dados para criar e administrar contas, prestar as funcionalidades contratadas, gerir reservas e clientes, enviar comunicações operacionais, processar faturação, prestar suporte, prevenir fraude e abuso, proteger a segurança e melhorar a fiabilidade da plataforma.',
          'As bases legais podem incluir a execução de um contrato, o cumprimento de obrigações legais, interesses legítimos da Silentra ou da barbearia, e consentimento quando este seja exigido pela legislação aplicável.',
          'As funcionalidades de marketing e mensagens devem ser utilizadas pela barbearia apenas quando esta disponha de uma base legal adequada para contactar os respetivos destinatários e cumpra as regras aplicáveis a comunicações comerciais.',
        ],
      },
      {
        title: '6. Reservas públicas e marketplace',
        paragraphs: [
          'O marketplace pode permitir que um cliente final pesquise uma barbearia e faça uma reserva sem criar uma conta. Os dados necessários à reserva são transmitidos à barbearia selecionada para que esta possa gerir a marcação.',
          'A Silentra fornece a infraestrutura tecnológica e não é responsável pelo serviço de barbearia, pela qualidade do atendimento, pelos preços, pela disponibilidade efetiva ou pelo cumprimento das obrigações da barbearia perante o cliente final.',
        ],
      },
      {
        title: '7. Cookies, analytics e registos técnicos',
        paragraphs: [
          'Utilizamos cookies e tecnologias equivalentes quando necessários para autenticação, segurança, preferências e funcionamento essencial da plataforma.',
          'Podemos recolher métricas de utilização e desempenho e manter logs técnicos e de auditoria para diagnosticar erros, detetar abuso, proteger contas e melhorar o serviço. Procuramos aplicar minimização e limitar o acesso a estes dados ao necessário.',
        ],
      },
      {
        title: '8. Partilha de dados',
        paragraphs: [
          'Podemos partilhar dados com fornecedores que atuam por nossa conta ou prestam serviços de infraestrutura, incluindo alojamento e infraestrutura (Vercel), base de dados, autenticação e armazenamento (Supabase), pagamentos e faturação (Stripe), email transacional e operacional (Brevo), gestão de etiquetas (Google Tag Manager), medição de utilização/desempenho (Vercel Analytics/Speed Insights) e medição de campanhas (Whop), de acordo com a funcionalidade e as preferências de consentimento.',
          'Partilhamos com a barbearia os dados necessários para gerir reservas e clientes associados à respetiva operação. Não vendemos dados pessoais a terceiros.',
          'Podemos divulgar dados quando tal seja exigido por lei, por autoridade competente, por ordem judicial ou quando necessário para proteger direitos, segurança e integridade da plataforma.',
        ],
      },
      {
        title: '9. Transferências internacionais',
        paragraphs: [
          'Alguns fornecedores podem tratar dados fora de Portugal ou do Espaço Económico Europeu. Quando aplicável, procuramos utilizar mecanismos legais adequados para transferências internacionais, incluindo decisões de adequação, cláusulas contratuais-tipo ou medidas complementares.',
        ],
      },
      {
        title: '10. Retenção e eliminação',
        paragraphs: [
          'Conservamos dados enquanto forem necessários para prestar o serviço, cumprir obrigações legais, gerir faturação, resolver litígios, prevenir fraude e manter backups operacionais.',
          'Após o encerramento de uma conta, alguns dados podem permanecer durante períodos legalmente exigidos ou necessários para segurança, auditoria e recuperação de sistemas. Quando deixam de ser necessários, são eliminados ou anonimizados de acordo com os nossos processos de retenção.',
        ],
      },
      {
        title: '11. Segurança',
        paragraphs: [
          'Aplicamos medidas técnicas e organizativas adequadas, incluindo controlo de acessos, segregação por barbearia, políticas de permissões, proteção de credenciais, validação server-side e monitorização de eventos relevantes.',
          'Nenhum sistema é completamente seguro. Deves utilizar credenciais fortes, não partilhar palavras-passe e comunicar imediatamente qualquer utilização suspeita da conta.',
        ],
      },
      {
        title: '12. Direitos dos titulares',
        paragraphs: [
          'Nos termos da legislação aplicável, podes exercer direitos de acesso, retificação, apagamento, limitação, oposição e portabilidade e retirar consentimento quando o tratamento se baseie em consentimento.',
          'Os pedidos relativos a dados tratados em nome de uma barbearia podem ter de ser encaminhados para essa barbearia quando esta atuar como responsável pelo tratamento. Para questões de privacidade da Silentra, contacta contact@silentra.me.',
          'Também podes apresentar reclamação junto da autoridade de controlo competente, incluindo a Comissão Nacional de Proteção de Dados (CNPD) em Portugal.',
        ],
      },
      {
        title: '13. Menores',
        paragraphs: [
          'A plataforma SaaS destina-se a profissionais e representantes de barbearias com capacidade legal para contratar. Não procuramos recolher diretamente dados de menores para criação de contas. Quando uma barbearia introduz dados de clientes menores, é responsável por assegurar que possui fundamento legal para esse tratamento.',
        ],
      },
      {
        title: '14. Alterações e contacto',
        paragraphs: [
          'Podemos atualizar esta política para refletir alterações legais, técnicas ou funcionais. A data da última revisão é apresentada no topo desta página.',
          'Para questões, pedidos de direitos ou dúvidas sobre privacidade, contacta contact@silentra.me.',
        ],
      },
      {
        title: '20. Informação facultada, pedidos e decisões automatizadas',
        paragraphs: [
          'Os dados assinalados como necessários no formulário de reserva ou nos campos obrigatórios da conta são necessários para criar a conta, responder ao pedido ou prestar a funcionalidade solicitada. Se não forneceres esses dados, poderemos não conseguir concluir a reserva ou prestar a funcionalidade. A data de nascimento, a localização do dispositivo e as preferências de marketing são opcionais, salvo indicação clara em contrário para uma função específica.',
          'Não tomamos decisões exclusivamente automatizadas que produzam efeitos jurídicos ou efeitos significativamente semelhantes sobre os titulares. A confirmação automática de uma reserva, a atualização do estado de uma marcação ou a contagem de utilizações de um plano são operações operacionais baseadas em regras da barbearia e não substituem uma avaliação humana de direitos ou elegibilidade legal.',
          'Podes apresentar um pedido de acesso, retificação, apagamento, limitação, oposição ou portabilidade através de contact@silentra.me. Quando tratarmos os dados por conta de uma barbearia, poderemos encaminhar o pedido para essa barbearia, que é normalmente a responsável pelo tratamento, e prestar-lhe a assistência contratada.',
          'Procuramos responder aos pedidos de direitos no prazo legal de um mês após a receção. Quando o pedido for complexo ou existirem vários pedidos, esse prazo pode ser prorrogado até dois meses adicionais, sendo-te comunicada a prorrogação e os respetivos motivos dentro do primeiro mês. Podemos solicitar informação adicional para confirmar a identidade quando tal seja necessário e proporcional.',
          'A conservação varia conforme a categoria e a finalidade. Documentos contabilísticos e fiscais podem estar sujeitos a prazos legais próprios; os restantes dados são conservados enquanto forem necessários para prestar o serviço, segurança, prevenção de fraude e resolução de litígios. Não existe um único prazo de eliminação aplicável a todas as categorias, e alguns registos técnicos ou cópias de segurança podem permanecer durante o respetivo ciclo operacional.',
          'Podes apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD) ou à autoridade de controlo competente no teu local de residência ou trabalho.',
        ],
      },
    ],
  },
  en: {
    lastUpdated: 'August 10, 2026',
    intro:
      'This Privacy Policy explains how Silentra for Barbers (' +
      '"Silentra") processes personal data when you use the SaaS barbershop management platform, public marketplace, booking, communications, analytics, and billing features.',
    sections: [
      {
        title: '1. Controller and roles',
        paragraphs: [
          'For account, platform administration, billing, security, and support data, Silentra acts as controller to the extent applicable.',
          'For end-customer data entered through a booking or managed by a barbershop, the barbershop is generally the controller and Silentra acts as a technology provider/processor, depending on the operation and applicable law.',
          'The barbershop is responsible for its processing purposes, lawful basis, transparency duties, and handling of data-subject requests for data it enters into the platform.',
        ],
      },
      {
        title: '2. Data we process',
        paragraphs: [
          'We may process account and authentication data, including name, email, phone number, account identifiers, role, and information required to secure sessions.',
          'We may process barbershop data, including name, contact details, address, opening hours, closed days, services, prices, professionals, commissions, and account settings.',
          'For bookings and customer management, we may process name, phone, email, service, professional, date and time, appointment status, notes, and information entered manually by the barbershop or customer.',
          'We may process reviews, usage data, audit records, technical information, session identifiers, subscription data, and information required to prevent abuse and maintain security.',
          'Push notifications may use technical data required to maintain a device subscription. Push is currently used for operational notifications to barbers, including new bookings.',
        ],
      },
      {
        title: '3. Billing and payments',
        paragraphs: [
          'Subscriptions and payments may be processed through Stripe. Silentra retains customer and subscription identifiers required to manage billing status but does not need to store the complete payment-card details used for payment.',
          'Accounts may use the free, pro, or enterprise plan. Features, quotas, and limits may vary by plan and may be updated in accordance with the Terms and the commercial conditions shown before purchase.',
        ],
      },
      {
        title: '4. Communications and providers',
        paragraphs: [
          'Silentra may use specialist providers for hosting, databases, payments, email, monitoring, and technical infrastructure. Providers receive only the data required to perform their services.',
          'Transactional and manual email may be sent through Brevo. The barbershop name may be used as the sender name for messages sent on its behalf.',
          'Manual SMS sending is currently disabled. Silentra should not be considered to be sending SMS through the platform while this feature remains disabled. If it is enabled in the future, this policy may be updated to reflect the relevant processing.',
        ],
      },
      {
        title: '5. Purposes and legal bases',
        paragraphs: [
          'We process data to create and administer accounts, provide contracted features, manage bookings and customers, send operational communications, process billing, provide support, prevent fraud and abuse, protect security, and improve platform reliability.',
          'Legal bases may include contract performance, legal obligations, legitimate interests of Silentra or the barbershop, and consent where required by applicable law.',
          'Marketing and messaging features must be used by barbershops only when they have an appropriate lawful basis to contact recipients and comply with applicable commercial-communications rules.',
        ],
      },
      {
        title: '6. Public bookings and marketplace',
        paragraphs: [
          'The marketplace may allow an end customer to discover a barbershop and book without creating an account. Required booking data is provided to the selected barbershop so it can manage the appointment.',
          "Silentra provides the technology infrastructure and is not responsible for the barbershop service, quality, pricing, actual availability, or the barbershop's obligations toward its customers.",
        ],
      },
      {
        title: '7. Cookies, analytics, and technical logs',
        paragraphs: [
          'We use cookies and equivalent technologies where needed for authentication, security, preferences, and essential platform functionality.',
          'We may collect usage and performance metrics and maintain technical and audit logs to diagnose errors, detect abuse, protect accounts, and improve the service. We seek to minimize data and restrict access to what is necessary.',
        ],
      },
      {
        title: '8. Data sharing',
        paragraphs: [
          'We may share data with providers acting on our behalf or providing infrastructure services, including hosting and infrastructure (Vercel), database, authentication and storage (Supabase), payments and billing (Stripe), transactional and operational email (Brevo), tag management (Google Tag Manager), usage/performance measurement (Vercel Analytics/Speed Insights), and campaign measurement (Whop), depending on the feature and consent preferences.',
          'We share with a barbershop the data needed to manage bookings and customers associated with its operation. We do not sell personal data to third parties.',
          'We may disclose data when required by law, competent authorities, court order, or when necessary to protect rights, security, and platform integrity.',
        ],
      },
      {
        title: '9. International transfers',
        paragraphs: [
          'Some providers may process data outside Portugal or the European Economic Area. Where applicable, we seek to use appropriate legal transfer mechanisms, including adequacy decisions, standard contractual clauses, or supplementary measures.',
        ],
      },
      {
        title: '10. Retention and deletion',
        paragraphs: [
          'We retain data for as long as necessary to provide the service, comply with legal obligations, manage billing, resolve disputes, prevent fraud, and maintain operational backups.',
          'After an account is closed, some data may remain for legally required periods or as necessary for security, auditing, and system recovery. When no longer required, it is deleted or anonymized under our retention processes.',
        ],
      },
      {
        title: '11. Security',
        paragraphs: [
          'We apply appropriate technical and organizational measures, including access controls, barbershop-level segregation, permission policies, credential protection, server-side validation, and monitoring of relevant events.',
          'No system is completely secure. You should use strong credentials, never share passwords, and report suspected account activity immediately.',
        ],
      },
      {
        title: '12. Data-subject rights',
        paragraphs: [
          'Subject to applicable law, you may exercise rights of access, rectification, erasure, restriction, objection, and portability, and withdraw consent where processing is based on consent.',
          'Requests relating to data processed on behalf of a barbershop may need to be directed to that barbershop when it acts as controller. For Silentra privacy matters, contact contact@silentra.me.',
          'You may also lodge a complaint with the competent supervisory authority, including the Portuguese Data Protection Authority (CNPD).',
        ],
      },
      {
        title: '13. Children',
        paragraphs: [
          "The SaaS platform is intended for professionals and authorized barbershop representatives with legal capacity to contract. We do not seek to collect children's data for account creation. When a barbershop enters data relating to minors, it is responsible for ensuring a lawful basis for that processing.",
        ],
      },
      {
        title: '14. Changes and contact',
        paragraphs: [
          'We may update this policy to reflect legal, technical, or functional changes. The last revision date is shown at the top of this page.',
          'For questions, rights requests, or privacy concerns, contact contact@silentra.me.',
        ],
      },
      {
        title: '20. Information provided, requests, and automated decisions',
        paragraphs: [
          'Data marked as required in a booking form or mandatory account fields is needed to create the account, respond to the request, or provide the requested feature. If you do not provide it, we may be unable to complete the booking or provide the feature. Date of birth, device location, and marketing preferences are optional unless clearly stated otherwise for a specific function.',
          'We do not make decisions based solely on automated processing that produce legal effects or similarly significant effects on data subjects. Automatic booking confirmation, booking-status updates, and plan-usage counts are operational actions based on barbershop rules and do not replace human assessment of rights or legal eligibility.',
          'You may submit an access, rectification, erasure, restriction, objection, or portability request through contact@silentra.me. Where we process data on behalf of a barbershop, we may forward the request to that barbershop, which is generally the controller, and provide the assistance agreed with it.',
          'We aim to respond to data-subject requests within the statutory one-month period after receipt. Where a request is complex or there are several requests, the period may be extended by up to two additional months; we will notify you of the extension and reasons within the first month. We may request additional information to verify identity where necessary and proportionate.',
          'Retention varies by category and purpose. Accounting and tax documents may be subject to specific statutory periods; other data is retained for as long as needed to provide the service, ensure security, prevent fraud, and resolve disputes. There is no single deletion period for every category, and some technical logs or backups may remain for their operational cycle.',
          'You may lodge a complaint with the Portuguese Data Protection Authority (CNPD) or the competent supervisory authority at your place of residence or work.',
        ],
      },
    ],
  },
};
