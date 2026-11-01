export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type TermsDocument = {
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

export const TERMS_LAST_UPDATED = '1 de novembro de 2026';

export const termsAndConditions: Record<'pt' | 'en', TermsDocument> = {
  pt: {
    lastUpdated: TERMS_LAST_UPDATED,
    intro:
      'Estes Termos e Condições regulam o acesso e a utilização da plataforma Silentra for Barbers («Silentra» ou «Plataforma»), um serviço SaaS para gestão de barbearias, reservas, clientes, comunicações, analytics e faturação. Ao criares uma conta, assinalares a aceitação expressa destes termos ou celebrares uma subscrição, aceitas o contrato aplicável. A navegação em páginas públicas, por si só, não constitui aceitação de um contrato de subscrição.',
    sections: [
      {
        title: '1. Serviço',
        paragraphs: [
          'A Silentra fornece software para ajudar barbearias a gerir agendamentos, clientes, serviços, profissionais, analytics, comunicações e outras operações disponibilizadas no plano aplicável.',
          'A Plataforma pode incluir um marketplace público através do qual clientes finais descobrem barbearias e efetuam reservas. A Silentra fornece tecnologia e não presta o serviço de barbearia.',
          'A barbearia é responsável pelos preços, horários, disponibilidade, qualidade do serviço, confirmação, alteração e cancelamento das marcações e pelo cumprimento das suas obrigações perante os clientes.',
        ],
      },
      {
        title: '2. Conta e elegibilidade',
        paragraphs: [
          'A utilização da conta destina-se a profissionais, proprietários ou representantes autorizados de barbearias com capacidade legal para contratar e, quando aplicável, idade mínima de 18 anos.',
          'Deves fornecer informação verdadeira, completa e atualizada e manter as credenciais da conta confidenciais. És responsável pelas atividades realizadas através da tua conta, salvo quando resultem de uma falha imputável à Silentra.',
          'Não podes utilizar a Plataforma para criar contas fraudulentas, aceder a dados de terceiros sem autorização ou contornar mecanismos de segurança ou limites do plano.',
        ],
      },
      {
        title: '3. Planos, funcionalidades e quotas',
        paragraphs: [
          'A Silentra disponibiliza diferentes níveis de subscrição, incluindo free, pro e enterprise. Cada plano pode ter funcionalidades, quotas, limites de utilização, número de profissionais, localizações, módulos e condições comerciais diferentes.',
          'O plano e as permissões aplicáveis são determinados pelo estado de subscrição da conta. A existência de uma interface para uma funcionalidade não constitui garantia de disponibilidade se essa funcionalidade não estiver incluída no plano aplicável.',
          'A Silentra pode alterar funcionalidades e limites de planos para novos contratos ou após comunicação de alterações relevantes. Não serão utilizadas alterações de plano para contornar direitos obrigatórios previstos na lei.',
        ],
      },
      {
        title: '4. Reservas e marketplace',
        paragraphs: [
          'As reservas podem ser criadas por clientes finais ou pela própria barbearia. A Plataforma tenta manter a agenda consistente, mas não garante disponibilidade ininterrupta, ausência absoluta de conflitos ou funcionamento sem erros.',
          'A barbearia deve verificar e gerir as marcações e contactar diretamente o cliente quando seja necessário corrigir uma marcação, indisponibilidade ou erro.',
          'O contrato relativo ao serviço de barbearia é celebrado diretamente entre o cliente e a barbearia identificada na página de reserva. A Silentra disponibiliza a infraestrutura tecnológica e não presta nem recebe o preço do serviço de barbearia. As condições concretas de cancelamento, atrasos, faltas e pré-pagamentos são definidas pela barbearia e devem ser apresentadas antes da confirmação, sem prejuízo dos direitos imperativos do consumidor. Consulta também a Política de Reservas.',
        ],
      },
      {
        title: '5. Comunicações',
        paragraphs: [
          'A Plataforma pode disponibilizar email, notificações push e outras funcionalidades de comunicação conforme o plano e a configuração da conta.',
          'Atualmente, as notificações push são utilizadas para alertar os barbeiros sobre eventos operacionais, incluindo novos bookings. A barbearia é responsável por utilizar estas funcionalidades de acordo com a legislação aplicável.',
          'O envio manual de email pode utilizar a infraestrutura da Brevo e o nome da barbearia como nome do remetente. O envio manual de SMS encontra-se atualmente desativado.',
          'Quando forem utilizadas funcionalidades de marketing ou mensagens para clientes, a barbearia é responsável por possuir uma base legal adequada, respeitar preferências de comunicação e cumprir as regras aplicáveis a comunicações comerciais.',
        ],
      },
      {
        title: '6. Dados pessoais',
        paragraphs: [
          'A utilização da Plataforma está sujeita à Política de Privacidade da Silentra. A barbearia permanece responsável pelos dados pessoais de clientes e profissionais que introduz e pelas obrigações legais que lhe sejam aplicáveis.',
          'A barbearia deve disponibilizar aos seus clientes informação adequada sobre o tratamento dos seus dados e obter consentimentos quando estes sejam legalmente necessários.',
          'A Silentra pode atuar como responsável pelo tratamento ou como subcontratante, consoante a finalidade e a operação. Quando a barbearia determina as finalidades e a Silentra trata dados de clientes por sua conta, as partes devem formalizar e aceitar a Adenda de Tratamento de Dados (DPA), disponível em /dpa, antes de esse tratamento começar.',
        ],
      },
      {
        title: '7. Propriedade intelectual e dados do cliente',
        paragraphs: [
          'A marca Silentra, software, design, documentação e componentes proprietários permanecem propriedade da Silentra ou dos respetivos licenciadores. Estes termos não transferem propriedade da Plataforma.',
          'A barbearia mantém os direitos sobre os dados comerciais que introduz. Concede à Silentra apenas os direitos necessários para alojar, processar, transmitir, fazer backup e utilizar esses dados para prestar e proteger o serviço.',
          'Não deves carregar conteúdo que viole direitos de terceiros, legislação aplicável ou estes termos.',
        ],
      },
      {
        title: '8. Utilização aceitável e segurança',
        paragraphs: [
          'É proibido tentar aceder a dados de outras contas ou barbearias, explorar vulnerabilidades, introduzir malware, interferir com a disponibilidade da Plataforma, realizar scraping abusivo, contornar quotas, praticar fraude ou utilizar a Plataforma para spam ou recolha ilícita de dados.',
          'Podemos limitar, bloquear ou suspender atividades que representem risco de segurança, abuso, fraude ou incumprimento destes termos, preservando os direitos legalmente aplicáveis.',
        ],
      },
      {
        title: '9. Faturação e pagamentos',
        paragraphs: [
          'Os planos pagos podem ser faturados através da Stripe. A subscrição free existente numa conta pode ser substituída por um plano pago quando o utilizador faz upgrade, de acordo com o fluxo de faturação apresentado pela Plataforma.',
          'O preço, periodicidade, impostos aplicáveis, eventual desconto, renovação e método de pagamento são apresentados antes da confirmação. As subscrições podem ser cobradas através da Stripe ou, quando o modo manual estiver ativo, por um processo de pagamento manual. Os pagamentos manuais só são considerados concluídos quando a Silentra confirma o respetivo recebimento.',
          'O cancelamento, a renovação, a data de fim de acesso e o tratamento de pedidos de reembolso seguem a informação mostrada na área de faturação e a Política de Faturação. O cancelamento não elimina direitos legais imperativos nem transforma automaticamente pagamentos de períodos já utilizados em valores reembolsáveis. A falta de pagamento, chargeback ou estado de subscrição incompatível pode resultar na limitação ou suspensão de funcionalidades pagas, após as notificações aplicáveis.',
        ],
      },
      {
        title: '10. Disponibilidade e alterações',
        paragraphs: [
          'A Plataforma é fornecida numa base de esforço razoável e pode ficar temporariamente indisponível devido a manutenção, atualizações, falhas de fornecedores, incidentes de segurança ou acontecimentos fora do controlo da Silentra.',
          'Podemos adicionar, alterar ou descontinuar funcionalidades. Quando uma alteração material afetar um serviço contratado, procuraremos comunicar a alteração de forma razoável, sem prejuízo dos direitos legais do utilizador.',
          'Funcionalidades experimentais ou beta podem ter limitações adicionais que serão indicadas quando disponibilizadas.',
        ],
      },
      {
        title: '11. Limitação de responsabilidade',
        paragraphs: [
          'Na máxima medida permitida pela lei, a Silentra não responde por perdas indiretas, perda de lucros, perda de oportunidade ou interrupção de negócio decorrentes da utilização da Plataforma, salvo quando a lei imponha responsabilidade que não possa ser excluída.',
          'A Silentra não garante que os dados, horários, disponibilidade ou métricas apresentados pela Plataforma estejam sempre livres de erros e a barbearia deve manter procedimentos próprios para verificar informação crítica.',
          'Nada nestes termos exclui ou limita responsabilidade que não possa legalmente ser excluída ou limitada, incluindo situações de dolo ou outras responsabilidades imperativas previstas na lei.',
        ],
      },
      {
        title: '12. Suspensão e encerramento',
        paragraphs: [
          'Podes deixar de utilizar a Plataforma e solicitar o encerramento da conta através dos mecanismos disponibilizados ou contactando contact.silentra@gmail.com.',
          'Podemos suspender ou encerrar uma conta em caso de violação destes termos, risco de segurança, fraude, obrigação legal ou abuso grave. Quando possível e adequado, será dada oportunidade para corrigir o incumprimento.',
          'Após encerramento, os dados podem ser conservados pelo período necessário para obrigações legais, faturação, resolução de litígios, segurança e backups, nos termos da Política de Privacidade.',
        ],
      },
      {
        title: '13. Alterações aos termos',
        paragraphs: [
          'Podemos atualizar estes termos para refletir alterações legais, técnicas, comerciais ou funcionais. A data da última revisão é apresentada no topo desta página.',
          'Alterações materiais serão comunicadas com antecedência razoável quando legalmente exigido ou apropriado. A utilização continuada após a entrada em vigor da nova versão constitui aceitação na medida permitida pela lei.',
        ],
      },
      {
        title: '14. Lei aplicável e contacto',
        paragraphs: [
          'Estes termos regem-se pela lei portuguesa, sem prejuízo das normas imperativas de proteção do consumidor ou outras regras que tenham aplicação obrigatória.',
          'Para questões sobre estes termos, faturação ou utilização da Plataforma, contacta contact.silentra@gmail.com. A identificação jurídica completa da entidade exploradora (denominação legal, morada e NIF) deve ser confirmada através deste contacto antes da contratação, caso não esteja apresentada no checkout ou na informação comercial.',
        ],
      },
    ],
  },
  en: {
    lastUpdated: 'November 1, 2026',
    intro:
      'These Terms and Conditions govern access to and use of the Silentra for Barbers platform ("Silentra" or the "Platform"), a SaaS service for barbershop management, bookings, customers, communications, analytics, and billing. By creating an account, expressly accepting these terms, or entering into a subscription, you accept the applicable agreement. Merely browsing public pages does not constitute acceptance of a subscription agreement.',
    sections: [
      {
        title: '1. Service',
        paragraphs: [
          'Silentra provides software to help barbershops manage appointments, customers, services, professionals, analytics, communications, and other operations made available under the applicable plan.',
          'The Platform may include a public marketplace through which end customers discover barbershops and make bookings. Silentra provides technology and does not provide barbershop services.',
          'The barbershop is responsible for pricing, schedules, availability, service quality, appointment confirmation, changes and cancellations, and compliance with its obligations toward customers.',
        ],
      },
      {
        title: '2. Account and eligibility',
        paragraphs: [
          'Accounts are intended for professionals, owners, or authorized representatives of barbershops with legal capacity to contract and, where applicable, a minimum age of 18.',
          'You must provide accurate, complete, and current information and keep your credentials confidential. You are responsible for activity performed through your account except where caused by a failure attributable to Silentra.',
          'You may not use the Platform to create fraudulent accounts, access third-party data without authorization, or bypass security mechanisms or plan limits.',
        ],
      },
      {
        title: '3. Plans, features, and quotas',
        paragraphs: [
          'Silentra offers different subscription levels, including free, pro, and enterprise. Plans may differ in features, quotas, usage limits, number of professionals, locations, modules, and commercial terms.',
          "The applicable plan and permissions are determined by the account's subscription state. The presence of a UI entry does not guarantee access where a feature is not included in the applicable plan.",
          'Silentra may change features and plan limits for new contracts or after notice of material changes. Changes will not be used to circumvent mandatory rights under applicable law.',
        ],
      },
      {
        title: '4. Bookings and marketplace',
        paragraphs: [
          'Bookings may be created by end customers or by the barbershop. The Platform attempts to keep schedules consistent but does not guarantee uninterrupted availability, complete absence of conflicts, or error-free operation.',
          'The barbershop must review and manage bookings and contact the customer directly when a booking, availability issue, or technical error needs correction.',
          'The contract for the barbershop service is made directly between the customer and the barbershop identified on the booking page. Silentra provides the technology infrastructure and does not provide the haircut or receive its service price. The specific rules for cancellation, lateness, no-shows, and prepayments are set by the barbershop and must be presented before the booking is confirmed, without prejudice to mandatory consumer rights. See also the Booking Policy.',
        ],
      },
      {
        title: '5. Communications',
        paragraphs: [
          'The Platform may provide email, push notifications, and other communication features depending on the plan and account configuration.',
          'Push notifications are currently used to alert barbers about operational events, including new bookings. The barbershop is responsible for using these features in accordance with applicable law.',
          'Manual email may use Brevo infrastructure and the barbershop name as the sender name. Manual SMS sending is currently disabled.',
          'When marketing or customer messaging features are used, the barbershop is responsible for having an appropriate lawful basis, respecting communication preferences, and complying with applicable commercial-communication rules.',
        ],
      },
      {
        title: '6. Personal data',
        paragraphs: [
          "Use of the Platform is subject to Silentra's Privacy Policy. The barbershop remains responsible for personal data relating to customers and professionals that it enters and for its applicable legal obligations.",
          'The barbershop must provide appropriate privacy information to customers and obtain consent where legally required.',
          "Silentra may act as controller or processor depending on the purpose and operation. Where the barbershop determines the purposes and Silentra processes customer data on its behalf, the parties must formalize and accept the Data Processing Addendum (DPA), available at /dpa, before that processing begins.",
        ],
      },
      {
        title: '7. Intellectual property and customer data',
        paragraphs: [
          'The Silentra brand, software, design, documentation, and proprietary components remain owned by Silentra or its licensors. These terms do not transfer ownership of the Platform.',
          'The barbershop retains rights in the business data it provides and grants Silentra only the rights required to host, process, transmit, back up, and use that data to provide and protect the service.',
          'You may not upload content that infringes third-party rights, applicable law, or these terms.',
        ],
      },
      {
        title: '8. Acceptable use and security',
        paragraphs: [
          "You may not attempt to access other accounts or barbershops' data, exploit vulnerabilities, introduce malware, interfere with Platform availability, perform abusive scraping, bypass quotas, commit fraud, or use the Platform for spam or unlawful data collection.",
          'We may limit, block, or suspend activity that creates a security, abuse, fraud, or terms-compliance risk, subject to applicable legal rights.',
        ],
      },
      {
        title: '9. Billing and payments',
        paragraphs: [
          'Paid plans may be billed through Stripe. An existing free subscription may be replaced by a paid plan when a user upgrades, according to the billing flow presented by the Platform.',
          'The price, billing interval, applicable taxes, any discount, renewal, and payment method are shown before confirmation. Subscriptions may be charged through Stripe or, when manual mode is enabled, through a manual payment process. Manual payments are only treated as completed when Silentra confirms receipt.',
          'Cancellation, renewal, the date paid access ends, and refund requests follow the information shown in the billing area and the Billing Policy. Cancellation does not remove mandatory legal rights or automatically make amounts for periods already used refundable. Non-payment, chargebacks, or an incompatible subscription state may result in limitations or suspension of paid features, subject to applicable notice requirements.',
        ],
      },
      {
        title: '10. Availability and changes',
        paragraphs: [
          "The Platform is provided on a reasonable-efforts basis and may be temporarily unavailable due to maintenance, updates, provider failures, security incidents, or events outside Silentra's control.",
          'We may add, change, or discontinue features. Where a material change affects a contracted service, we will seek to communicate it reasonably, without prejudice to mandatory legal rights.',
          'Experimental or beta features may have additional limitations that will be disclosed when made available.',
        ],
      },
      {
        title: '11. Limitation of liability',
        paragraphs: [
          'To the maximum extent permitted by law, Silentra is not liable for indirect losses, lost profits, lost opportunities, or business interruption arising from use of the Platform, except where liability cannot lawfully be excluded.',
          'Silentra does not guarantee that data, schedules, availability, or metrics displayed by the Platform will always be error-free, and the barbershop should maintain its own procedures for verifying critical information.',
          'Nothing in these terms excludes or limits liability that cannot legally be excluded or limited, including wilful misconduct or other mandatory liabilities.',
        ],
      },
      {
        title: '12. Suspension and termination',
        paragraphs: [
          'You may stop using the Platform and request account closure through available account mechanisms or by contacting contact.silentra@gmail.com.',
          'We may suspend or terminate an account for terms violations, security risks, fraud, legal obligations, or serious abuse. Where appropriate and possible, we will provide an opportunity to remedy the breach.',
          'After termination, data may be retained as necessary for legal obligations, billing, dispute resolution, security, and backups, as described in the Privacy Policy.',
        ],
      },
      {
        title: '13. Changes to these terms',
        paragraphs: [
          'We may update these terms to reflect legal, technical, commercial, or functional changes. The last revision date is shown at the top of this page.',
          'Material changes will be communicated with reasonable notice where legally required or appropriate. Continued use after the effective date constitutes acceptance to the extent permitted by law.',
        ],
      },
      {
        title: '14. Governing law and contact',
        paragraphs: [
          'These terms are governed by Portuguese law, without prejudice to mandatory consumer-protection rules or other provisions that must apply.',
          'For questions about these terms, billing, or use of the Platform, contact contact.silentra@gmail.com. The full legal identification of the operating entity (legal name, address, and tax number) should be confirmed through this contact before contracting if it is not already shown at checkout or in the commercial information.',
        ],
      },
    ],
  },
};
