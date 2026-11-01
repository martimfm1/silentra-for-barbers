import type { LegalSection } from '@/lib/legal/terms-and-conditions';

export const acceptableUsePolicy: Record<'pt' | 'en', {
  lastUpdated: string;
  intro: string;
  sections: readonly LegalSection[];
}> = {
  pt: {
    lastUpdated: '1 de novembro de 2026',
    intro: 'Esta política resume as regras de utilização aceitável da Silentra for Barbers. Aplica-se a titulares de contas, membros de equipas, integrações e pessoas que utilizem funcionalidades públicas ou autenticadas.',
    sections: [
      {
        title: '1. Utilização permitida',
        paragraphs: [
          'Utiliza a plataforma apenas para gerir atividades legítimas da barbearia, prestar serviços aos clientes, administrar a equipa, efetuar reservas e tratar dados para finalidades comunicadas e legalmente permitidas.',
          'Deves garantir que tens autorização para aceder à conta, aos dados, aos ficheiros e às integrações que utilizas.',
        ],
      },
      {
        title: '2. Acesso, contas e permissões',
        paragraphs: [
          'Não partilhes credenciais nem permitas que pessoas não autorizadas utilizem a tua conta. Atribui a cada membro apenas as permissões necessárias e remove o acesso quando deixar de precisar dele.',
          'Não tentes contornar limites do plano, permissões da equipa, controlos de acesso, isolamento entre barbearias ou mecanismos de faturação.',
        ],
      },
      {
        title: '3. Dados pessoais, mensagens e marketing',
        paragraphs: [
          'Só deves recolher e inserir dados pessoais necessários para uma finalidade legítima, informando os titulares e obtendo consentimento quando for exigido. Não introduzas dados sensíveis sem acordo e base legal adequados.',
          'Não utilizes email, notificações, automações ou campanhas para spam, assédio ou comunicações comerciais sem base legal. Respeita oposições, pedidos de não contacto e preferências de comunicação.',
          'Não exportes, copies, vendas ou partilhes dados de clientes fora das finalidades autorizadas. Não tentes identificar pessoas a partir de dados agregados ou públicos.',
        ],
      },
      {
        title: '4. Segurança e integridade técnica',
        paragraphs: [
          'É proibido explorar vulnerabilidades, fazer testes de intrusão sem autorização escrita, introduzir malware, interferir com a disponibilidade, contornar rate limits, automatizar scraping abusivo ou tentar aceder a dados privados de outra barbearia.',
          'Não efetues engenharia reversa, descompilação ou modificação de componentes proprietários, salvo quando a lei o permita ou exista autorização expressa.',
          'Comunica vulnerabilidades ou acessos suspeitos a contact@silentra.me, sem explorar, alterar, copiar ou divulgar dados encontrados.',
        ],
      },
      {
        title: '5. Conteúdo e propriedade intelectual',
        paragraphs: [
          'És responsável por garantir que tens direitos para publicar logótipos, fotografias, textos, preços, avaliações, marcas e outros conteúdos. Não carregues conteúdos ilícitos, enganadores, discriminatórios, difamatórios ou que infrinjam direitos de terceiros.',
          'A Silentra pode remover ou restringir conteúdo que viole a lei, estes termos ou direitos de terceiros, respeitando os procedimentos e direitos aplicáveis.',
        ],
      },
      {
        title: '6. API, marketplace e páginas públicas',
        paragraphs: [
          'Os consumidores da API devem seguir a documentação, limites técnicos, versões e restrições de cache. Não contornes limites, não recolhas dados de forma abusiva, não reidentifiques pessoas e não apresentes dados públicos de modo enganador.',
          'A barbearia é responsável por manter os seus dados públicos corretos, atuais e legalmente publicáveis.',
        ],
      },
      {
        title: '7. Incumprimento e contacto',
        paragraphs: [
          'A Silentra pode aplicar medidas proporcionais, incluindo limitação, suspensão ou encerramento de acesso, quando existam motivos razoáveis de segurança, fraude, abuso, obrigação legal ou incumprimento, preservando direitos legais e, quando adequado, dando oportunidade de correção.',
          'Para comunicar um problema de segurança ou esclarecer uma utilização permitida, contacta contact@silentra.me.',
        ],
      },
    ],
  },
  en: {
    lastUpdated: 'November 1, 2026',
    intro: 'This policy summarizes the acceptable-use rules for Silentra for Barbers. It applies to account owners, team members, integrations, and people using public or authenticated features.',
    sections: [
      {
        title: '1. Permitted use',
        paragraphs: [
          'Use the platform only to manage legitimate barbershop activities, serve customers, administer the team, make bookings, and process data for disclosed and legally permitted purposes.',
          'You must ensure that you are authorized to access the account, data, files, and integrations you use.',
        ],
      },
      {
        title: '2. Access, accounts, and permissions',
        paragraphs: [
          'Do not share credentials or allow unauthorized people to use your account. Give each team member only the permissions they need and remove access when it is no longer required.',
          'Do not bypass plan limits, team permissions, access controls, separation between barbershops, or billing mechanisms.',
        ],
      },
      {
        title: '3. Personal data, messaging, and marketing',
        paragraphs: [
          'Collect and enter personal data only when necessary for a legitimate purpose, provide information to data subjects, and obtain consent where required. Do not enter sensitive data without an appropriate agreement and lawful basis.',
          'Do not use email, notifications, automations, or campaigns for spam, harassment, or commercial messages without a lawful basis. Respect objections, do-not-contact requests, and communication preferences.',
          'Do not export, copy, sell, or share customer data outside authorized purposes. Do not attempt to identify people from aggregated or public data.',
        ],
      },
      {
        title: '4. Security and technical integrity',
        paragraphs: [
          'You must not exploit vulnerabilities, perform penetration testing without written authorization, introduce malware, interfere with availability, bypass rate limits, automate abusive scraping, or attempt to access another barbershop’s private data.',
          'Do not reverse engineer, decompile, or modify proprietary components except where permitted by law or expressly authorized.',
          'Report vulnerabilities or suspected unauthorized access to contact@silentra.me without exploiting, changing, copying, or disclosing any data found.',
        ],
      },
      {
        title: '5. Content and intellectual property',
        paragraphs: [
          'You are responsible for ensuring that you have rights to publish logos, photos, text, prices, reviews, trademarks, and other content. Do not upload unlawful, misleading, discriminatory, defamatory, or third-party-infringing content.',
          'Silentra may remove or restrict content that violates law, these terms, or third-party rights, subject to applicable procedures and rights.',
        ],
      },
      {
        title: '6. API, marketplace, and public pages',
        paragraphs: [
          'API consumers must follow documentation, technical limits, versions, and caching restrictions. Do not bypass limits, collect data abusively, re-identify people, or present public data misleadingly.',
          'The barbershop is responsible for keeping its public information accurate, current, and lawful to publish.',
        ],
      },
      {
        title: '7. Breaches and contact',
        paragraphs: [
          'Silentra may take proportionate measures, including access restrictions, suspension, or termination, where there are reasonable grounds involving security, fraud, abuse, legal obligations, or non-compliance, while preserving legal rights and providing an opportunity to remedy where appropriate.',
          'To report a security issue or clarify permitted use, contact contact@silentra.me.',
        ],
      },
    ],
  },
};
