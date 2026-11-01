import type { LegalSection } from '@/lib/legal/terms-and-conditions';

type PolicyDocument = {
  lastUpdated: string;
  intro: string;
  sections: readonly LegalSection[];
};

type LocalizedPolicy = Record<'pt' | 'en', PolicyDocument>;

const PT_DATE = '1 de novembro de 2026';
const EN_DATE = 'November 1, 2026';

export const bookingPolicy: LocalizedPolicy = {
  pt: {
    lastUpdated: PT_DATE,
    intro:
      'Esta política explica o que acontece quando utilizas uma página de reserva da Silentra para marcar um serviço numa barbearia. A reserva e o serviço são geridos pela barbearia identificada na página; a Silentra fornece a tecnologia de marcação.',
    sections: [
      {
        title: '1. Quem presta o serviço',
        paragraphs: [
          'O contrato relativo ao corte ou a outro serviço é celebrado diretamente entre ti e a barbearia que escolheste. A barbearia é responsável pelo serviço, pelos profissionais, preços, horários, disponibilidade, confirmação, alteração e cancelamento da marcação.',
          'A Silentra disponibiliza a página e a infraestrutura tecnológica para consultar serviços e solicitar marcações. Não presta o serviço de barbearia, não escolhe o profissional em nome da barbearia e não recebe o preço do serviço de barbearia.',
          'Antes de confirmares, verifica o nome e os contactos da barbearia, o serviço, o profissional, a data, a hora, o preço e as condições que a própria barbearia apresenta.',
        ],
      },
      {
        title: '2. Pedido e confirmação da marcação',
        paragraphs: [
          'O envio de um pedido não significa necessariamente que a marcação já esteja confirmada. A página e a mensagem apresentada no fim do processo indicam se a marcação foi confirmada automaticamente ou se aguarda confirmação da barbearia.',
          'Quando a confirmação automática está ativa, o sistema pode confirmar o pedido de acordo com as regras e a disponibilidade configuradas pela barbearia. A barbearia continua responsável por acompanhar a agenda e corrigir eventuais erros ou conflitos.',
          'Deves guardar a mensagem de confirmação e contactar diretamente a barbearia quando não receberes confirmação, existir informação incorreta ou precisares de alterar a marcação.',
        ],
      },
      {
        title: '3. Cancelamentos, alterações e faltas',
        paragraphs: [
          'A barbearia define e apresenta as condições operacionais de cancelamento, alteração, atraso e não comparência, incluindo o prazo de antecedência que configurou. Não existe um prazo universal de cancelamento definido pela Silentra para todas as barbearias.',
          'Consulta as condições apresentadas na página de reserva e na confirmação antes de concluir o pedido. Para cancelar, reagendar ou esclarecer uma taxa, contacta a barbearia através dos contactos indicados na sua página.',
          'As regras da barbearia não afastam direitos imperativos que te sejam reconhecidos pela legislação de defesa do consumidor, incluindo os direitos que possam aplicar-se a contratos celebrados à distância e a serviços com data ou período de execução específicos.',
        ],
      },
      {
        title: '4. Pré-pagamento MB WAY',
        paragraphs: [
          'Algumas barbearias com a funcionalidade ativa podem pedir um pré-pagamento por MB WAY. O número apresentado pertence à barbearia e o pagamento é efetuado diretamente para a conta indicada por esta; a Silentra não recebe, guarda nem movimenta esse montante.',
          'Quando o pré-pagamento exige validação, o pedido fica pendente até a barbearia verificar o recebimento e confirmar a marcação. Enviar uma captura de ecrã ou iniciar uma transferência não prova, por si só, que o valor foi recebido.',
          'O pedido pode expirar e o horário pode ser libertado se o pagamento não for validado dentro do prazo indicado no fluxo de reserva. Em caso de pagamento efetuado mas não reconhecido, contacta diretamente a barbearia e apresenta o comprovativo através de um canal seguro.',
          'Qualquer devolução ou questão relacionada com o montante pago deve ser tratada com a barbearia, sem prejuízo dos direitos legais aplicáveis. A Silentra pode ajudar a encaminhar um problema técnico, mas não controla a conta bancária da barbearia.',
        ],
      },
      {
        title: '5. Dados necessários para a reserva',
        paragraphs: [
          'Para criar e gerir a marcação, a página pode pedir o teu nome e um meio de contacto, bem como o serviço, profissional e horário pretendidos. A data de nascimento ou outros dados adicionais só devem ser fornecidos quando solicitados e necessários para a funcionalidade explicada.',
          'Os dados da marcação são disponibilizados à barbearia escolhida para esta poder organizar e prestar o serviço, contactar-te, gerir alterações e cumprir as suas obrigações. A Política de Privacidade explica os papéis da barbearia e da Silentra.',
          'Não introduzas informação sensível ou dados de outras pessoas sem autorização. Se fizeres uma reserva em nome de outra pessoa, assegura-te de que tens autorização para fornecer os respetivos dados.',
        ],
      },
      {
        title: '6. Menores e reservas em nome de terceiros',
        paragraphs: [
          'Se a reserva disser respeito a um menor ou for realizada em nome de outra pessoa, o adulto que efetua o pedido deve assegurar que tem autoridade para fornecer os dados necessários e deve consultar a barbearia quando existirem dúvidas sobre consentimento, acompanhamento ou condições do serviço.',
        ],
      },
      {
        title: '7. Ajuda e reclamações',
        paragraphs: [
          'Para dúvidas sobre o serviço, preços, atrasos, cancelamento, pré-pagamento ou reembolso, contacta primeiro a barbearia indicada na confirmação.',
          'Para dificuldades técnicas com a página de reserva ou questões sobre o funcionamento da plataforma, contacta contact@silentra.me. Não envies palavras-passe, códigos de autenticação ou dados completos de cartões por email.',
          'Esta política não limita os teus direitos legais. Podes recorrer às entidades de resolução de conflitos de consumo ou às autoridades competentes quando aplicável.',
        ],
      },
    ],
  },
  en: {
    lastUpdated: EN_DATE,
    intro:
      'This policy explains what happens when you use a Silentra booking page to reserve a service at a barbershop. The booking and service are managed by the barbershop identified on the page; Silentra provides the booking technology.',
    sections: [
      {
        title: '1. Who provides the service',
        paragraphs: [
          'The contract for a haircut or another service is made directly between you and the barbershop you selected. The barbershop is responsible for the service, professionals, prices, schedules, availability, confirmation, changes, and cancellation.',
          'Silentra provides the page and technology infrastructure for viewing services and requesting bookings. It does not provide the barbershop service, choose the professional on the barbershop’s behalf, or receive the barbershop service price.',
          'Before confirming, check the barbershop name and contact details, service, professional, date, time, price, and the conditions presented by the barbershop.',
        ],
      },
      {
        title: '2. Booking request and confirmation',
        paragraphs: [
          'Submitting a request does not necessarily mean that the booking is already confirmed. The page and the message shown at the end of the process indicate whether the booking was automatically confirmed or is waiting for the barbershop.',
          'When automatic confirmation is enabled, the system may confirm a request according to the rules and availability configured by the barbershop. The barbershop remains responsible for monitoring the schedule and correcting errors or conflicts.',
          'Keep the confirmation message and contact the barbershop directly if you do not receive confirmation, details are incorrect, or you need to change the booking.',
        ],
      },
      {
        title: '3. Cancellation, changes, and no-shows',
        paragraphs: [
          'The barbershop sets and displays its operational conditions for cancellation, changes, lateness, and no-shows, including the notice period it has configured. Silentra does not set one universal cancellation period for every barbershop.',
          'Review the conditions displayed on the booking page and in the confirmation before completing the request. To cancel, reschedule, or ask about a fee, contact the barbershop using the details on its page.',
          'The barbershop’s rules do not remove mandatory consumer rights that apply to you, including rights that may apply to distance contracts and services provided on a specific date or period.',
        ],
      },
      {
        title: '4. MB WAY prepayment',
        paragraphs: [
          'Some barbershops with the feature enabled may request an MB WAY prepayment. The displayed number belongs to the barbershop and payment is made directly to the account it identifies; Silentra does not receive, hold, or move that amount.',
          'Where prepayment requires review, the request remains pending until the barbershop checks receipt and confirms the booking. Sending a screenshot or initiating a transfer does not, by itself, prove that the amount was received.',
          'The request may expire and the time slot may be released if payment is not validated within the period stated in the booking flow. If you paid but the payment is not recognized, contact the barbershop directly and provide proof through a secure channel.',
          'Any refund or question about the amount paid must be handled with the barbershop, without prejudice to mandatory legal rights. Silentra may help route a technical issue but does not control the barbershop’s bank account.',
        ],
      },
      {
        title: '5. Data required for a booking',
        paragraphs: [
          'To create and manage the booking, the page may ask for your name and a contact method, as well as the requested service, professional, and time. Date of birth or other additional data should only be provided when requested and needed for the feature explained.',
          'Booking data is made available to the selected barbershop so it can arrange and provide the service, contact you, manage changes, and meet its obligations. The Privacy Policy explains the roles of the barbershop and Silentra.',
          'Do not enter sensitive information or another person’s data without authorization. If you book on behalf of someone else, ensure you are authorized to provide their details.',
        ],
      },
      {
        title: '6. Minors and bookings for other people',
        paragraphs: [
          'If the booking concerns a minor or is made on behalf of another person, the adult submitting the request must ensure they have authority to provide the necessary data and should check with the barbershop if there are questions about consent, supervision, or service conditions.',
        ],
      },
      {
        title: '7. Help and complaints',
        paragraphs: [
          'For questions about the service, prices, lateness, cancellation, prepayment, or refunds, contact the barbershop named in the confirmation first.',
          'For technical issues with the booking page or questions about the platform, contact contact@silentra.me. Do not email passwords, authentication codes, or full card details.',
          'This policy does not limit your legal rights. You may use consumer dispute-resolution bodies or competent authorities where applicable.',
        ],
      },
    ],
  },
};

export const billingPolicy: LocalizedPolicy = {
  pt: {
    lastUpdated: PT_DATE,
    intro:
      'Esta política explica como funcionam os planos de subscrição da Silentra for Barbers, os métodos de pagamento, a renovação, o cancelamento e a gestão de pedidos de reembolso.',
    sections: [
      {
        title: '1. Planos e informação antes da compra',
        paragraphs: [
          'A Silentra disponibiliza planos Free, Pro e Enterprise. As funcionalidades, quotas, limites, número de profissionais, localizações e serviços incluídos dependem do plano e da informação apresentada na página de planos e no checkout.',
          'Antes de confirmares uma subscrição, verifica o preço total, a periodicidade, os impostos aplicáveis, eventuais descontos, a data de renovação e o método de pagamento. Se algo não estiver claro, contacta-nos antes de concluir a compra.',
          'Uma funcionalidade visível na interface não significa que esteja incluída no plano da conta. O acesso é determinado server-side pelo estado efetivo da subscrição e pelas permissões aplicáveis.',
        ],
      },
      {
        title: '2. Métodos de pagamento',
        paragraphs: [
          'Quando o checkout Stripe está ativo, os pagamentos recorrentes são processados pela Stripe, de acordo com as condições que o checkout apresenta. Os dados completos do cartão são tratados pelo prestador de pagamentos e não são guardados pela Silentra como número completo de cartão.',
          'Quando o modo de pagamento manual está ativo, a Silentra pode disponibilizar instruções para transferência ou MB WAY. Um pedido ou comprovativo enviado não significa que o pagamento esteja confirmado: o acesso pago só é ativado após verificação e registo do recebimento pela Silentra.',
          'A data de início ou renovação do acesso e a eventual necessidade de confirmação manual são indicadas na área de faturação ou nas instruções do pedido.',
        ],
      },
      {
        title: '3. Renovação e cancelamento',
        paragraphs: [
          'Para subscrições recorrentes, a periodicidade e a próxima cobrança são as apresentadas no checkout e na área de faturação. É tua responsabilidade consultar a data de renovação e cancelar antes da cobrança seguinte caso não pretendas continuar.',
          'Quando a opção de cancelamento está disponível na área de faturação, podes solicitar o cancelamento através desse fluxo. A página deve indicar se o acesso termina imediatamente ou no fim do período já pago. Guarda a confirmação do cancelamento.',
          'Se não conseguires cancelar online, contacta contact@silentra.me antes da próxima data de cobrança. O contacto não substitui o pedido de cancelamento quando a área de faturação disponibiliza um fluxo funcional, mas permite comunicar uma falha técnica.',
        ],
      },
      {
        title: '4. Promoções e períodos gratuitos',
        paragraphs: [
          'As promoções dependem de elegibilidade, validade, limites e condições apresentadas no checkout. A promoção TRIALPRO, quando disponível, destina-se apenas a contas elegíveis e não é um período experimental universal.',
          'Após o período promocional, a subscrição pode renovar pelo preço e periodicidade normais indicados no checkout, salvo se for cancelada ou alterada antes da cobrança aplicável. Confirma sempre o valor final antes de concluir.',
        ],
      },
      {
        title: '5. Faturas, impostos e dados de faturação',
        paragraphs: [
          'Deves manter os dados de faturação corretos e completos, incluindo a identificação fiscal quando aplicável. Os documentos fiscais são emitidos de acordo com a configuração e o processo de faturação aplicáveis à conta.',
          'Os impostos, incluindo IVA quando devido, são apresentados ou calculados no fluxo de compra de acordo com a informação fiscal disponível. Se os dados fiscais estiverem incorretos, contacta o suporte e indica o número do documento, sem enviares dados de pagamento completos.',
        ],
      },
      {
        title: '6. Pedidos de reembolso',
        paragraphs: [
          'Os pedidos de reembolso são analisados caso a caso, considerando o método de pagamento, os serviços efetivamente prestados, o estado da subscrição, a informação apresentada no momento da compra e os direitos legais aplicáveis.',
          'O cancelamento de uma subscrição não significa automaticamente o reembolso de períodos já utilizados. Esta regra não limita direitos imperativos que possam exigir reembolso, incluindo situações de cobrança indevida ou outras previstas na lei.',
          'Para pedir análise, contacta contact@silentra.me com o email da conta, o identificador do pagamento ou documento e uma descrição do pedido. Nunca envies o número completo do cartão ou códigos de autenticação.',
        ],
      },
      {
        title: '7. Planos de clientes criados pela barbearia',
        paragraphs: [
          'Os planos mensais personalizados que uma barbearia cria para os seus próprios clientes são uma relação comercial entre essa barbearia e o respetivo cliente. A barbearia define preço, serviços incluídos, número de utilizações, datas, pagamentos, pausas e cancelamento.',
          'Esses valores não são subscrições da Silentra nem são cobrados pela Silentra. Para questões sobre o plano de um cliente, pagamento MB WAY, utilização de cortes ou reembolso, o cliente deve contactar diretamente a barbearia.',
        ],
      },
      {
        title: '8. Falhas de pagamento e contacto',
        paragraphs: [
          'Uma falha de pagamento, chargeback ou estado de subscrição inválido pode suspender o acesso a funcionalidades pagas. Quando possível, a área de faturação apresenta o estado e as ações necessárias para regularizar a conta.',
          'Para dúvidas sobre faturação ou pagamentos, contacta contact@silentra.me. Esta política não exclui nem limita direitos legais que não possam ser afastados por contrato.',
        ],
      },
    ],
  },
  en: {
    lastUpdated: EN_DATE,
    intro:
      'This policy explains how Silentra for Barbers subscriptions, payment methods, renewals, cancellations, and refund requests work.',
    sections: [
      {
        title: '1. Plans and information before purchase',
        paragraphs: [
          'Silentra offers Free, Pro, and Enterprise plans. Features, quotas, limits, number of professionals, locations, and included services depend on the plan and the information shown on the plans page and checkout.',
          'Before confirming a subscription, review the total price, billing interval, applicable taxes, any discount, renewal date, and payment method. Contact us before purchase if anything is unclear.',
          'A feature visible in the interface is not necessarily included in your account plan. Access is determined server-side by the effective subscription state and applicable permissions.',
        ],
      },
      {
        title: '2. Payment methods',
        paragraphs: [
          'When Stripe checkout is enabled, recurring payments are processed by Stripe under the conditions shown at checkout. Full card details are handled by the payment provider and are not stored by Silentra as a complete card number.',
          'When manual payment mode is enabled, Silentra may provide bank-transfer or MB WAY instructions. A request or submitted proof does not mean payment is confirmed: paid access is activated only after Silentra verifies and records receipt.',
          'The access start or renewal date and any manual confirmation requirement are shown in the billing area or in the payment instructions.',
        ],
      },
      {
        title: '3. Renewal and cancellation',
        paragraphs: [
          'For recurring subscriptions, the billing interval and next charge are those shown at checkout and in the billing area. You should check the renewal date and cancel before the next charge if you do not wish to continue.',
          'When cancellation is available in the billing area, you may request it through that flow. The page should indicate whether access ends immediately or at the end of the already-paid period. Keep the cancellation confirmation.',
          'If you cannot cancel online, contact contact@silentra.me before the next billing date. Contacting support does not replace the cancellation request where a functional billing cancellation flow is available, but it allows you to report a technical failure.',
        ],
      },
      {
        title: '4. Promotions and free periods',
        paragraphs: [
          'Promotions depend on eligibility, validity, limits, and the conditions shown at checkout. The TRIALPRO promotion, when available, applies only to eligible accounts and is not a universal free trial.',
          'After a promotional period, the subscription may renew at the normal price and interval shown at checkout unless it is canceled or changed before the applicable charge. Always check the final amount before confirming.',
        ],
      },
      {
        title: '5. Invoices, taxes, and billing information',
        paragraphs: [
          'You must keep billing information accurate and complete, including tax identification where applicable. Fiscal documents are issued under the billing configuration and process that apply to the account.',
          'Taxes, including VAT where due, are shown or calculated in the purchase flow according to the available tax information. If billing details are incorrect, contact support and provide the document number without sending full payment details.',
        ],
      },
      {
        title: '6. Refund requests',
        paragraphs: [
          'Refund requests are reviewed case by case, taking into account the payment method, services actually supplied, subscription state, information shown at purchase, and applicable legal rights.',
          'Canceling a subscription does not automatically mean that already-used periods are refunded. This does not limit mandatory rights that may require a refund, including improper charges or other cases provided by law.',
          'To request a review, contact contact@silentra.me with the account email, payment or document identifier, and a description of the request. Never send a full card number or authentication codes.',
        ],
      },
      {
        title: '7. Customer plans created by a barbershop',
        paragraphs: [
          'Custom monthly plans that a barbershop creates for its own customers are a commercial relationship between that barbershop and its customer. The barbershop sets the price, included services, number of uses, dates, payments, pauses, and cancellation.',
          'These amounts are not Silentra subscriptions and are not collected by Silentra. For questions about a customer plan, MB WAY payment, haircut allowance, or refund, the customer should contact the barbershop directly.',
        ],
      },
      {
        title: '8. Payment failures and contact',
        paragraphs: [
          'A failed payment, chargeback, or invalid subscription state may suspend access to paid features. Where possible, the billing area shows the status and actions needed to restore the account.',
          'For billing or payment questions, contact contact@silentra.me. This policy does not exclude or limit legal rights that cannot be waived by contract.',
        ],
      },
    ],
  },
};

export const dataProcessingAddendum: LocalizedPolicy = {
  pt: {
    lastUpdated: PT_DATE,
    intro:
      'Esta Adenda de Tratamento de Dados («DPA») aplica-se quando uma barbearia ou entidade profissional utiliza a Silentra para tratar dados pessoais de clientes ou profissionais por sua conta. A barbearia é normalmente o responsável pelo tratamento e a Silentra o subcontratante para essas operações. Esta adenda deve ser aceite pelas partes antes de o tratamento começar.',
    sections: [
      {
        title: '1. Partes, âmbito e duração',
        paragraphs: [
          'O responsável pelo tratamento é a entidade que controla a conta e utiliza a plataforma para gerir a sua barbearia. O subcontratante é a entidade que explora e presta o serviço Silentra for Barbers, cuja identificação legal completa deve constar do contrato, checkout ou informação comercial aplicável.',
          'A DPA cobre o tratamento de dados pessoais que a Silentra efetua por instruções documentadas da barbearia para prestar, alojar, manter, proteger e suportar as funcionalidades contratadas. Não cobre os tratamentos em que a Silentra determine autonomamente as finalidades e meios como responsável pelo tratamento, descritos na Política de Privacidade.',
          'A duração corresponde à vigência da conta e dos serviços relevantes, incluindo o período necessário para exportação, devolução, eliminação ou conservação legal após o encerramento.',
        ],
      },
      {
        title: '2. Natureza, finalidade e categorias',
        paragraphs: [
          'A natureza do tratamento inclui recolha, registo, organização, armazenamento, consulta, utilização, comunicação à própria barbearia, suporte técnico, cópia de segurança, restrição e eliminação, conforme as funcionalidades utilizadas.',
          'As finalidades incluem gerir reservas e clientes, agenda, serviços e profissionais, comunicações operacionais, CRM, avaliações, fidelização, automações e outras funções ativadas pela barbearia.',
          'As categorias de dados podem incluir identificadores e contactos, nome, email, telefone, data de nascimento, dados de reserva, serviço, profissional, data/hora, estado, notas, histórico, preferências e metadados técnicos. Não devem ser introduzidas categorias especiais de dados, salvo se a funcionalidade e uma base legal adequada tiverem sido acordadas separadamente.',
          'Os titulares podem incluir clientes da barbearia, potenciais clientes que submetem pedidos de reserva, profissionais e pessoas de contacto da própria barbearia.',
        ],
      },
      {
        title: '3. Instruções documentadas e confidencialidade',
        paragraphs: [
          'A Silentra trata dados pessoais apenas segundo instruções documentadas da barbearia, incluindo as operações realizadas através das funcionalidades e definições da conta, salvo quando uma norma da União Europeia ou portuguesa exigir outro tratamento. Quando tal obrigação existir, a Silentra informa a barbearia antes do tratamento, salvo proibição legal.',
          'As pessoas autorizadas a tratar dados estão vinculadas a deveres de confidencialidade e recebem apenas os acessos necessários às suas funções.',
          'A barbearia garante que possui base legal para recolher e transmitir os dados, que prestou a informação exigida aos titulares e que as instruções dadas à Silentra são lícitas.',
        ],
      },
      {
        title: '4. Medidas de segurança',
        paragraphs: [
          'A Silentra aplica medidas técnicas e organizativas adequadas ao risco e à natureza dos dados, incluindo controlo de acessos, autenticação, segregação por barbearia, permissões server-side, cifragem em trânsito fornecida pela infraestrutura, registos técnicos, cópias de segurança e processos de resposta a incidentes.',
          'As medidas são revistas de forma proporcional à evolução do serviço e podem ser descritas com maior detalhe mediante pedido razoável, sem divulgar informação que comprometa a segurança da plataforma ou de outros clientes.',
          'A barbearia deve proteger as suas credenciais, atribuir permissões de forma restrita, remover acessos de pessoas que deixem a equipa e evitar exportações ou partilhas desnecessárias.',
        ],
      },
      {
        title: '5. Subcontratantes ulteriores',
        paragraphs: [
          'A barbearia concede autorização geral para a utilização dos fornecedores indicados na Lista de Subprocessadores publicada em /subprocessors, na medida em que sejam necessários para a funcionalidade contratada.',
          'A Silentra mantém uma lista atualizada e comunicará alterações materiais quando aplicável, através da publicação da lista e/ou dos canais de contacto disponíveis. A barbearia pode apresentar uma objeção fundamentada por motivos de proteção de dados dentro do prazo comunicado. Se não for possível resolver uma objeção legítima, as partes devem discutir uma alternativa ou a cessação da funcionalidade afetada.',
          'Cada subprocessador deve estar sujeito a obrigações de proteção de dados adequadas ao serviço que presta. A Silentra permanece responsável perante a barbearia pelo desempenho das obrigações de proteção de dados dos subprocessadores na medida exigida pelo RGPD.',
        ],
      },
      {
        title: '6. Assistência e pedidos dos titulares',
        paragraphs: [
          'Tendo em conta a natureza do tratamento, a Silentra presta assistência razoável à barbearia para responder a pedidos de acesso, retificação, apagamento, limitação, oposição e portabilidade, bem como a pedidos relativos a consentimento, quando a informação necessária esteja sob o controlo da Silentra.',
          'Se a Silentra receber diretamente um pedido relativo a dados controlados pela barbearia, encaminhará o pedido para a barbearia ou informará o titular de que deve contactar o responsável pelo tratamento, sem responder ao mérito em nome da barbearia salvo instrução ou obrigação legal.',
          'A assistência pode depender da informação fornecida pela barbearia, do âmbito técnico do serviço e dos custos razoáveis de trabalho extraordinário quando o pedido exceda a assistência normal incluída.',
        ],
      },
      {
        title: '7. Incidentes, DPIA e auditorias',
        paragraphs: [
          'A Silentra notificará a barbearia de uma violação de dados pessoais que afete dados tratados ao abrigo desta DPA sem demora injustificada após ter conhecimento do incidente, fornecendo a informação disponível necessária para a barbearia cumprir as suas obrigações legais. A notificação não constitui, por si só, uma admissão de responsabilidade.',
          'A Silentra prestará assistência razoável para avaliações de impacto sobre a proteção de dados e consulta prévia à autoridade de controlo, na medida em que a informação esteja disponível e seja necessária para o tratamento realizado pela plataforma.',
          'A barbearia pode solicitar informação razoável para demonstrar o cumprimento desta DPA e realizar uma auditoria proporcional, com aviso prévio razoável, durante horário normal, protegendo informação confidencial, segurança da plataforma e dados de outros clientes. Quando possível, a auditoria deve recorrer primeiro a documentação e certificações existentes.',
        ],
      },
      {
        title: '8. Devolução, eliminação e conservação',
        paragraphs: [
          'No fim dos serviços, a barbearia pode solicitar a devolução ou eliminação dos dados pessoais tratados por sua conta, conforme as funcionalidades de exportação e os mecanismos técnicos disponíveis. O pedido deve ser feito para contact@silentra.me.',
          'A eliminação pode ser limitada por obrigações legais de conservação, prevenção de fraude, segurança, resolução de litígios ou ciclos de cópia de segurança. Os dados abrangidos por essas exceções ficam limitados e protegidos, sendo eliminados quando deixarem de ser necessários.',
          'Nem todas as exportações ou eliminações são atualmente executadas por um botão automático. A Silentra confirma o âmbito, a possibilidade técnica e as exceções aplicáveis antes de concluir o pedido.',
        ],
      },
      {
        title: '9. Transferências internacionais e contacto',
        paragraphs: [
          'Quando os dados forem tratados fora do Espaço Económico Europeu, a transferência deve basear-se num mecanismo permitido pelo RGPD, como uma decisão de adequação ou garantias apropriadas, incluindo cláusulas contratuais-tipo quando aplicáveis. A lista de subprocessadores identifica os fornecedores conhecidos e deve ser consultada em conjunto com a configuração efetiva da conta.',
          'Para exercer direitos enquanto responsável pelo tratamento, a barbearia deve contactar contact@silentra.me. Esta DPA deve ser revista e aceite pelas partes e não substitui acordos adicionais legalmente exigidos para operações específicas.',
        ],
      },
    ],
  },
  en: {
    lastUpdated: EN_DATE,
    intro:
      'This Data Processing Addendum (DPA) applies when a barbershop or professional entity uses Silentra to process customer or professional personal data on its behalf. The barbershop is generally the controller and Silentra the processor for those operations. The parties must accept this addendum before the processing begins.',
    sections: [
      {
        title: '1. Parties, scope, and duration',
        paragraphs: [
          'The controller is the entity that controls the account and uses the platform to manage its barbershop. The processor is the entity operating and providing Silentra for Barbers, whose full legal identity must appear in the applicable contract, checkout, or commercial information.',
          'This DPA covers personal data processed by Silentra on the barbershop’s documented instructions to provide, host, maintain, protect, and support the contracted features. It does not cover processing for which Silentra independently determines purposes and means as controller, as described in the Privacy Policy.',
          'The term corresponds to the account and relevant services, including the time needed for export, return, deletion, or legally required retention after termination.',
        ],
      },
      {
        title: '2. Nature, purpose, and categories',
        paragraphs: [
          'Processing may include collection, recording, organization, storage, consultation, use, communication to the barbershop, technical support, backup, restriction, and deletion, depending on the features used.',
          'Purposes include managing bookings and customers, schedules, services and professionals, operational communications, CRM, reviews, loyalty, automations, and other functions enabled by the barbershop.',
          'Data categories may include identifiers and contact details, name, email, phone, date of birth, booking details, service, professional, date/time, status, notes, history, preferences, and technical metadata. Special categories of data should not be entered unless the feature and a suitable lawful basis have been separately agreed.',
          'Data subjects may include barbershop customers, prospective customers submitting booking requests, professionals, and barbershop contact persons.',
        ],
      },
      {
        title: '3. Documented instructions and confidentiality',
        paragraphs: [
          'Silentra processes personal data only on the barbershop’s documented instructions, including operations carried out through account features and settings, unless EU or Portuguese law requires otherwise. Where such an obligation applies, Silentra informs the barbershop before processing unless legally prohibited.',
          'Persons authorized to process data are bound by confidentiality duties and receive only access needed for their roles.',
          'The barbershop warrants that it has a lawful basis to collect and provide the data, has given required information to data subjects, and that its instructions to Silentra are lawful.',
        ],
      },
      {
        title: '4. Security measures',
        paragraphs: [
          'Silentra applies technical and organizational measures appropriate to the risk and nature of the data, including access controls, authentication, barbershop-level segregation, server-side permissions, encryption in transit provided by the infrastructure, technical logs, backups, and incident-response processes.',
          'Measures are reviewed proportionately as the service evolves and may be described in more detail on reasonable request, without disclosing information that would compromise the platform’s security or other customers.',
          'The barbershop must protect credentials, assign permissions narrowly, remove access when team members leave, and avoid unnecessary exports or sharing.',
        ],
      },
      {
        title: '5. Subprocessors',
        paragraphs: [
          'The barbershop gives general authorization for the use of the providers listed in the Subprocessor List at /subprocessors, to the extent required for the contracted feature.',
          'Silentra maintains an updated list and will communicate material changes where applicable, through publication of the list and/or available contact channels. The barbershop may raise a reasoned data-protection objection within the communicated period. If a legitimate objection cannot be resolved, the parties should discuss an alternative or termination of the affected feature.',
          'Each subprocessor must be subject to data-protection obligations appropriate to its service. Silentra remains responsible to the barbershop for the subprocessors’ performance of data-protection obligations to the extent required by the GDPR.',
        ],
      },
      {
        title: '6. Assistance and data-subject requests',
        paragraphs: [
          'Taking into account the nature of the processing, Silentra provides reasonable assistance to the barbershop in responding to access, rectification, erasure, restriction, objection, and portability requests, and consent-related requests, where the necessary information is under Silentra’s control.',
          'If Silentra directly receives a request relating to data controlled by the barbershop, it will forward the request to the barbershop or inform the data subject that they should contact the controller, without deciding the merits on the barbershop’s behalf unless instructed or legally required.',
          'Assistance may depend on information supplied by the barbershop, the technical scope of the service, and reasonable costs for extraordinary work beyond the ordinary included assistance.',
        ],
      },
      {
        title: '7. Incidents, DPIAs, and audits',
        paragraphs: [
          'Silentra will notify the barbershop of a personal-data breach affecting data processed under this DPA without undue delay after becoming aware of it, providing available information necessary for the barbershop to meet its legal obligations. Notification is not, by itself, an admission of liability.',
          'Silentra will provide reasonable assistance with data-protection impact assessments and prior consultation with a supervisory authority, to the extent the information is available and necessary for the processing carried out by the platform.',
          'The barbershop may request reasonable information to demonstrate compliance with this DPA and carry out a proportionate audit on reasonable prior notice, during normal business hours, protecting confidential information, platform security, and other customers’ data. Where possible, existing documentation and certifications should be used first.',
        ],
      },
      {
        title: '8. Return, deletion, and retention',
        paragraphs: [
          'At the end of the services, the barbershop may request return or deletion of personal data processed on its behalf, subject to the export features and technical mechanisms available. Requests should be sent to contact@silentra.me.',
          'Deletion may be limited by legal retention duties, fraud prevention, security, dispute resolution, or backup cycles. Data covered by these exceptions remains restricted and protected and is deleted when no longer required.',
          'Not all exports or deletions are currently performed through an automatic button. Silentra confirms the scope, technical feasibility, and applicable exceptions before completing a request.',
        ],
      },
      {
        title: '9. International transfers and contact',
        paragraphs: [
          'Where data is processed outside the European Economic Area, the transfer must rely on a GDPR-permitted mechanism, such as an adequacy decision or appropriate safeguards, including standard contractual clauses where applicable. The subprocessor list identifies known providers and should be read together with the account’s actual configuration.',
          'To exercise its controller responsibilities, the barbershop should contact contact@silentra.me. This DPA should be reviewed and accepted by the parties and does not replace additional agreements legally required for specific operations.',
        ],
      },
    ],
  },
};

export const subprocessorsPolicy: LocalizedPolicy = {
  pt: {
    lastUpdated: PT_DATE,
    intro:
      'Esta página identifica os fornecedores tecnológicos conhecidos que podem tratar dados pessoais quando utilizas funcionalidades da Silentra. A utilização concreta depende da funcionalidade, da configuração da conta e das tuas escolhas de consentimento.',
    sections: [
      {
        title: '1. Alojamento, infraestrutura e base de dados',
        paragraphs: [
          'Vercel — alojamento da aplicação, entrega de conteúdo e execução de funções da plataforma. Pode tratar dados técnicos de pedidos e registos operacionais necessários à prestação e segurança do serviço.',
          'Supabase — base de dados, autenticação e armazenamento de ficheiros utilizados pela plataforma. Pode tratar dados de conta, barbearias, reservas, CRM, ficheiros e metadados técnicos de acordo com as funcionalidades utilizadas.',
          'AWS S3 — armazenamento de objetos e ficheiros, apenas quando a integração S3 estiver configurada e for utilizada nesta implementação. Os dados transmitidos dependem do tipo de ficheiro e da funcionalidade que o utiliza.',
        ],
      },
      {
        title: '2. Pesquisa de moradas e mapas',
        paragraphs: [
          'Mapbox — pesquisa e geocodificação de moradas através da API do servidor. Quando utilizas o autocomplete, o texto da morada, código postal e localidade é enviado ao Mapbox. Se autorizares a localização do dispositivo, as coordenadas podem ser enviadas como proximidade para ordenar sugestões. O token Mapbox permanece no servidor.',
          'CARTO — fornecimento dos mosaicos de mapa utilizados no diretório público de barbearias. O browser solicita as imagens correspondentes à área do mapa que está a visualizar; esses pedidos podem incluir o endereço IP, metadados técnicos e coordenadas dos mosaicos consultados. A localização do dispositivo não é guardada pela Silentra na base de dados.',
        ],
      },
      {
        title: '3. Pagamentos e faturação',
        paragraphs: [
          'Stripe — processamento de pagamentos de subscrições, estado de cobrança, faturas e eventos de faturação quando o checkout Stripe está ativo. Os dados de cartão são tratados pela Stripe de acordo com o seu serviço; a Silentra conserva identificadores e estado de subscrição necessários à gestão da conta.',
        ],
      },
      {
        title: '4. Email e comunicações',
        paragraphs: [
          'Brevo — envio de email transacional e operacional, incluindo mensagens relacionadas com marcações, notificações e comunicações configuradas. Pode tratar o endereço de email, o nome do destinatário e metadados de entrega.',
        ],
      },
      {
        title: '5. Estatísticas, desempenho e marketing',
        paragraphs: [
          'Vercel Analytics e Vercel Speed Insights — medição de utilização e desempenho, apenas quando a categoria de estatísticas está autorizada.',
          'Whop — pixel de medição de campanhas e eventos, apenas quando a categoria de marketing está autorizada.',
          'Google Tag Manager — gestão de etiquetas de terceiros. É carregado apenas quando estatísticas e marketing estão ambas autorizadas, porque o contentor pode executar etiquetas de diferentes finalidades. A lista efetiva de etiquetas depende da configuração publicada no contentor e deve ser revista antes de cada alteração.',
        ],
      },
      {
        title: '6. Transferências internacionais',
        paragraphs: [
          'A localização de tratamento pode variar por fornecedor, produto, região, suporte ou configuração da conta. Quando um fornecedor trate dados fora do Espaço Económico Europeu, a transferência deve estar coberta por um mecanismo permitido pelo RGPD, como uma decisão de adequação ou garantias apropriadas, incluindo cláusulas contratuais-tipo quando aplicável.',
          'Esta página não substitui a consulta dos contratos e definições reais de cada fornecedor. Para obter informação sobre o mecanismo aplicável a um fornecedor ou conta específica, contacta contact@silentra.me.',
        ],
      },
      {
        title: '7. Alterações à lista',
        paragraphs: [
          'A lista pode ser atualizada quando novos fornecedores forem introduzidos, removidos ou substituídos. As barbearias que atuem como responsáveis pelo tratamento devem consultar esta página juntamente com a DPA e podem apresentar uma objeção fundamentada nos termos dessa adenda.',
        ],
      },
    ],
  },
  en: {
    lastUpdated: EN_DATE,
    intro:
      'This page identifies known technology providers that may process personal data when you use Silentra features. Actual use depends on the feature, account configuration, and your consent choices.',
    sections: [
      {
        title: '1. Hosting, infrastructure, and database',
        paragraphs: [
          'Vercel — application hosting, content delivery, and execution of platform functions. It may process technical request data and operational logs needed to provide and secure the service.',
          'Supabase — database, authentication, and file storage used by the platform. It may process account, barbershop, booking, CRM, file, and technical metadata according to the features used.',
          'AWS S3 — object and file storage, only when the S3 integration is configured and used in this deployment. The data transmitted depends on the file type and the feature using it.',
        ],
      },
      {
        title: '2. Address search and maps',
        paragraphs: [
          'Mapbox — address search and geocoding through the server API. When you use autocomplete, the address text, postal code, and city are sent to Mapbox. If you authorize device location, coordinates may be sent as proximity to rank suggestions. The Mapbox token remains on the server.',
          'CARTO — map tiles used by the public barbershop directory. The browser requests the images corresponding to the map area being viewed; those requests may include IP address, technical metadata, and coordinates of the requested tiles. Silentra does not store the device location in its database.',
        ],
      },
      {
        title: '3. Payments and billing',
        paragraphs: [
          'Stripe — processing subscription payments, billing state, invoices, and billing events when Stripe checkout is enabled. Card data is handled by Stripe under its service; Silentra retains the identifiers and subscription state needed to manage the account.',
        ],
      },
      {
        title: '4. Email and communications',
        paragraphs: [
          'Brevo — sending transactional and operational email, including booking-related messages, notifications, and configured communications. It may process email address, recipient name, and delivery metadata.',
        ],
      },
      {
        title: '5. Analytics, performance, and marketing',
        paragraphs: [
          'Vercel Analytics and Vercel Speed Insights — usage and performance measurement, only when the analytics category is authorized.',
          'Whop — campaign and event measurement pixel, only when the marketing category is authorized.',
          'Google Tag Manager — third-party tag management. It loads only when both analytics and marketing are authorized because the container may run tags for different purposes. The actual tag list depends on the published container configuration and should be reviewed before each change.',
        ],
      },
      {
        title: '6. International transfers',
        paragraphs: [
          'Processing location may vary by provider, product, region, support, or account configuration. Where a provider processes data outside the European Economic Area, the transfer must be covered by a GDPR-permitted mechanism, such as an adequacy decision or appropriate safeguards, including standard contractual clauses where applicable.',
          'This page does not replace review of the actual contracts and settings of each provider. For information about the mechanism applicable to a specific provider or account, contact contact@silentra.me.',
        ],
      },
      {
        title: '7. Changes to this list',
        paragraphs: [
          'This list may be updated when providers are added, removed, or replaced. Barbershops acting as controllers should review this page together with the DPA and may raise a reasoned objection under that addendum.',
        ],
      },
    ],
  },
};
