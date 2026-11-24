# Production operations — Silentra for Barbers

Este runbook descreve como validar e recuperar o serviço. Não substitui a execução dos exercícios em staging nem a configuração dos providers.

## 1. Objetivos operacionais provisórios

Proposta inicial para aprovação do responsável pela plataforma:

- **RPO (perda máxima de dados): 24 horas** para dados transacionais; usar PITR se disponível no plano Supabase.
- **RTO (tempo-alvo de recuperação): 4 horas** para restabelecer os fluxos críticos.
- **Disponibilidade:** definir SLO depois de recolher pelo menos 30 dias de métricas reais.

Estes valores são objetivos propostos, não garantias atuais. Rever após medir custos, plano Supabase, volume e requisitos dos clientes.

## 2. Antes de cada release

1. Confirmar CI verde no PR: typecheck, lint, auditorias, build e smoke QA.
2. Rever migrations novas e confirmar que não alteram migrations já aplicadas.
3. Aplicar migrations em staging com a mesma ordem da história de produção.
4. Executar testes de isolamento A→A/A→B, quotas Free/Pro/Enterprise, booking concorrente e fluxos de billing.
5. Confirmar variáveis de ambiente no ambiente correto sem imprimir valores secretos.
6. Testar login, onboarding, marcação, confirmação, checkout, webhooks e emails.
7. Guardar o SHA do commit e o deployment anterior estável.

## 3. Backups e recuperação Supabase

### Configuração

- Confirmar no painel Supabase o plano de backups ativo e a retenção real.
- Ativar PITR quando disponível e aprovado no orçamento.
- Não guardar dumps de produção em repositórios, tickets ou pastas públicas.
- Restringir acesso aos backups e cifrar cópias exportadas.
- Documentar quem pode iniciar um restore e como obter aprovação.

### Exercício de recuperação

1. Escolher uma janela de manutenção e avisar os responsáveis.
2. Restaurar para um projeto Supabase isolado de staging — nunca sobre produção durante o exercício.
3. Confirmar migration history, tabelas, índices, funções, triggers, RLS, policies e Storage.
4. Executar `pnpm qa:plans`, `pnpm qa:security`, `pnpm qa:api` e smoke QA contra o ambiente restaurado.
5. Validar os fluxos booking, clientes, subscrições, marketplace/encomendas e emails com dados de teste.
6. Registar o timestamp do backup, duração, falhas e o RPO/RTO efetivamente observado.
7. Só declarar o exercício concluído após aprovação humana e registo do resultado.

**Estado atual:** não existe evidência de um restore testado nesta branch. Não marcar como concluído até executar o exercício no projeto real.

## 4. Monitorização e incidentes

Monitorizar pelo menos:

- Percentagem e contagem de respostas HTTP 5xx, 429 e 409.
- Latência p50/p95/p99 por rota.
- Falhas de persistência em `platform_api_logs`.
- Erros e atrasos de webhooks Stripe e falhas de envio Brevo.
- Erros de autenticação, booking e checkout.
- Uso de recursos e limites do Supabase/Vercel.

Alertas devem apontar para uma pessoa responsável e incluir rota, ambiente, região, timestamp e `x-request-id`; nunca incluir tokens, emails, telefones, payloads completos ou secrets.

### Resposta a incidente

1. Classificar impacto: indisponibilidade, integridade de dados, acesso cross-tenant ou exposição de dados.
2. Conter: desativar endpoint/integração afetada ou reverter deployment, sem destruir evidência.
3. Se houver suspeita de credenciais expostas, revogar e rodar secrets afetados.
4. Guardar IDs de pedido, intervalos temporais e logs redigidos.
5. Recuperar serviço e verificar integridade de dados e eventos de billing.
6. Documentar causa raiz, impacto, ações corretivas e testes de regressão.

## 5. Rollback

1. Identificar o último deployment estável e respetivo SHA.
2. Reverter a aplicação através do mecanismo de rollback do Vercel.
3. Não assumir que rollback da aplicação reverte uma migration SQL.
4. Para alterações de DB, preparar migration corretiva forward-only sempre que possível; restore de backup exige plano de recuperação aprovado.
5. Testar health, login, booking, billing, webhook e email após rollback.
6. Registar o motivo, duração, impacto e ações de follow-up.

### Rollback específico — marketing consent e campanhas manuais
Migration `20261123010746_manual_marketing_campaigns_and_preferences`:

- **Rollback da aplicação:** é seguro voltar ao deployment anterior mantendo a migration aplicada. O schema é aditivo; a versão anterior da aplicação pode ignorar as tabelas e funções novas.
- **Não executar um down migration destrutivo:** não remover `marketing_contact_preferences`, `marketing_campaign_monthly_usage` nem as respetivas funções enquanto existirem registos. A primeira tabela guarda prova de consentimento/revogação; a segunda guarda a quota mensal. Apagá-las pode voltar a permitir envios a contactos que fizeram unsubscribe ou repor quotas já consumidas.
- **Não restaurar automaticamente o estado antigo de campanhas de aniversário:** a migration recupera ciclos que tinham destinatários falhados. Repor `birthday_last_run_date` sem reconciliar os destinatários pode impedir retries ou duplicar mensagens.
- **Correção de schema:** preferir uma migration forward-only e idempotente. Antes de alterar ou retirar a funcionalidade, desativar os envios no servidor, preservar os registos e documentar a reconciliação de consentimentos/quota. Uma restauração de backup requer plano aprovado e verificação de integridade antes de reabrir envios.
- **Verificação pós-aplicação:** confirmar a versão/nome na migration history; existência das duas tabelas; RLS ativo em ambas; acesso de leitura negado a `anon` e `authenticated`, concedido a `service_role`; funções `reserve_marketing_campaign_send`, `release_marketing_campaign_send` e `claim_birthday_marketing_campaign` com `SECURITY INVOKER` e execução limitada a `service_role`. Executar `pnpm qa:communication-growth`, `pnpm qa:security` e Smoke QA.
- **Estado verificado em produção (24/11/2026):** migration history contém `20261123010746 / manual_marketing_campaigns_and_preferences`; as duas tabelas existem, têm RLS ativo, as permissões de leitura correspondem ao esperado e as três funções são `SECURITY INVOKER`. A verificação foi read-only; não foram executados DDL nem alterações de dados durante a auditoria.

## 6. Verificação de providers

### Stripe

- Confirmar endpoint e signing secret do webhook no ambiente correto.
- Testar eventos duplicados, fora de ordem, falha de pagamento, cancelamento no fim do período e alterações de plano.
- Verificar que o entitlement só é concedido após validação server-side do estado do provider.
- Confirmar que eventos repetidos não duplicam faturas, subscrições ou emails.

### Brevo

- Confirmar sender validado e estado SPF/DKIM/DMARC no DNS.
- Testar confirmação, cancelamento, aniversário e mensagem manual.
- Verificar que falhas de email são registadas e não desfazem operações de negócio já concluídas.
- Confirmar idioma PT-PT/EN da barbearia nos templates que suportam localização.

## 7. Aprovação de lançamento

Não declarar o produto pronto para lançamento comercial enquanto os testes de staging, restore, isolamento, billing e golden path não estiverem documentados, a CI não estiver verde e a revisão jurídica/privacidade não estiver concluída.
