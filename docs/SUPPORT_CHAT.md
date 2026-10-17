# Support Chat — operação e segurança

O chat de suporte da plataforma é um canal privado entre o proprietário da barbearia e a equipa Silentra. Não é o sistema de mensagens de marketing/CRM da barbearia.

## Fluxo

1. Um proprietário autenticado abre **Dashboard → Suporte Silentra** e envia a primeira mensagem.
2. A API confirma a sessão no Supabase Auth, o papel `owner`, a barbearia associada e a origem da requisição. O servidor calcula o plano efetivo e cria uma conversa por barbearia.
3. A mensagem é guardada como texto simples. O RPC `support_send_message` serializa envios por conversa e cria uma notificação no outbox quando o destinatário passa de sem mensagens por ler para ter mensagens por ler.
4. A equipa responde em **Silentra Admin → Suporte**. As conversas são ordenadas por plano (Enterprise, Pro, Free), depois por mensagens por ler e atividade recente.
5. O destinatário recebe email transacional via Brevo com uma ligação direta à área de chat. Enquanto houver mensagens por ler, novos envios não geram um email por cada mensagem; a notificação representa o lote de mensagens ainda por ler.
6. As falhas de entrega ficam na tabela `support_email_notifications`, com limite de cinco tentativas e backoff. O worker programado processa notificações pendentes/falhadas.

## Prioridade por plano

| Plano efetivo | Prioridade | Comportamento |
| --- | ---: | --- |
| Enterprise | 3 | Ordem de tratamento superior |
| Pro | 2 | Tratamento prioritário |
| Free | 1 | Fila standard |

O plano é resolvido no backend a partir de atribuições de plano válidas e subscrições elegíveis. Nunca é aceite um valor de plano ou prioridade enviado pelo browser.

## APIs

- `GET /api/support/conversations` — lê a conversa da barbearia autenticada e assinala como lidas as mensagens de suporte recebidas.
- `POST /api/support/conversations` — cria/recupera a conversa e envia uma mensagem.
- `GET /api/silentra-admin/support` — lista a inbox; aceita `conversationId` para carregar mensagens.
- `POST /api/silentra-admin/support` — envia uma resposta da equipa.
- `PATCH /api/silentra-admin/support` — marca mensagens como lidas ou atualiza o estado da conversa.
- `GET /api/cron/support-email-notifications` — processa o outbox; requer `Authorization: Bearer CRON_SECRET` ou `x-cron-secret`.

## Dados e controlos

- RLS está ativo nas três tabelas e o acesso direto é revogado para `anon` e `authenticated`; APIs server-side usam a service role.
- O painel admin exige `requirePlatformAdmin()`, que usa a allowlist já configurada.
- O endpoint do membro exige utilizador autenticado, papel de proprietário e barbearia própria.
- As APIs de escrita verificam a origem, limitam o tamanho das mensagens e impõem rate limiting.
- O conteúdo é renderizado como texto React, nunca como HTML arbitrário.
- O email contém um excerto escapado e um link de acesso; não inclui credenciais nem tokens de autenticação.
- O outbox guarda estado/erros de entrega e tenta novamente até cinco vezes. A falha de email não apaga uma mensagem já aceite e guardada.

## Deploy

1. Aplicar a migration `supabase/migrations/20261017130000_platform_support_chat.sql` no projeto Supabase usado pela aplicação.
2. Confirmar que `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL` (ou `SENDER_EMAIL`), e a identidade admin `SILENTRA_PLATFORM_ADMIN_EMAIL` ou `SILENTRA_PLATFORM_ADMIN_USER_ID` estão configuradas no ambiente de produção.
3. Confirmar que o email admin pode ser resolvido. Se só estiver configurado o ID, esse utilizador tem de existir no Supabase Auth com email.
4. O cron `/api/cron/support-email-notifications` está configurado diariamente às 00:45 UTC para retentativas, para manter a configuração compatível com a Vercel Hobby. O envio inicial é tentado imediatamente após a gravação da mensagem. Uma frequência de retentativas inferior a um dia exige um plano Vercel que suporte cron subdiário ou um scheduler externo autenticado.
5. Executar `pnpm qa:support`, `pnpm typecheck`, `pnpm lint` e `pnpm build`. Depois, testar com uma conta Free e outra Pro/Enterprise: criar conversa, responder em ambos os sentidos, marcar como lida, mudar o estado e confirmar emails.

## Observações operacionais

A criação de mensagens e a inserção da notificação inicial são transacionais dentro do RPC. A chamada a Brevo ocorre após o commit para evitar manter uma transação da base de dados aberta enquanto um fornecedor externo responde. Os emails falhados permanecem registados e a mensagem continua disponível no chat.
