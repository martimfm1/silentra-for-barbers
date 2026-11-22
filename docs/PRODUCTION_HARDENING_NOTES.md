# Silentra for Barbers — Production Hardening Notes

**Auditoria inicial:** 1 de novembro de 2026  
**Issue de acompanhamento:** [#157 — Production hardening](https://github.com/martimfm1/silentra-for-barbers/issues/157)  
**Branch de trabalho:** `fix/production-hardening-p0`

Este documento é o bloco de notas persistente da auditoria. A issue contém os critérios de conclusão; aqui fica o histórico técnico, decisões e progresso.

## Resumo da auditoria

### P0 — Segurança e isolamento

- [x] Remover acesso anónimo direto a `appointments` (SELECT/INSERT/UPDATE/DELETE).
- [x] Restringir SELECT/INSERT/UPDATE/DELETE de marcações a staff do tenant com permissões `agenda` / `appointments`.
- [x] Bloquear updates de `users.role`, `users.barbershop_id`, `users.id` e timestamps através do Data API.
- [x] Limitar CRUD da tabela `users` a dados CRM de clientes no tenant, sem permitir alteração de roles.
- [x] Remover políticas permissivas de UPDATE de `barbershops`; apenas owner/admin do tenant podem atualizar.
- [x] Adicionar contratos QA estáticos para grants/RLS; CI configurada para os executar.

### P1 — Supabase, Auth e migrations

- [x] Rever as funções `SECURITY DEFINER` sinalizadas. As 14 funções expostas a `authenticated` foram revistas: todas validam `auth.uid()` e têm `search_path` fixo; as RPCs de gestão de equipa foram endurecidas e verificadas em produção. As restantes são RPCs intencionais, mantidas com autorização interna e acesso autenticado.
- [ ] Ativar leaked-password protection.
- [x] Rever 33 tabelas RLS sem policies e separar tabelas internas server-only. Foram revogados grants de `anon`/`authenticated` em sete tabelas internas; acesso `service_role` foi preservado e verificado.
- [x] Aplicar e sincronizar a migration de fidelização `20261101230417_fix_loyalty_redemption_api`.
- [x] Aplicar e validar a migration `20261101235220_optimize_rls_policy_initplans`: cache de `auth.uid()`/helper por statement e consolidação de políticas duplicadas em `shops`, `services`, `marketing_campaigns`, `barbershop_dashboard_customizations`, `subscriptions` e `reviews`. A revisão confirmou que as condições de acesso existentes são preservadas.

### P1 — Performance

- [ ] Rever as 58 foreign keys ainda sem índices de cobertura. As três FKs de `appointments` com maior impacto já foram cobertas pela migration `20261101235218_add_appointment_reference_indexes`.
- [ ] Rever os pares de índices duplicados. Além dos quatro grupos assinalados pelo advisor, foi confirmado manualmente um quinto par redundante em `locations(parent_barbershop_id)`. A migration `20261101235218_add_appointment_reference_indexes` remove apenas os duplicados comprovados em `appointments.management_token`, `locations(parent_barbershop_id)`, `locations(parent_barbershop_id, slug)`, `loyalty_rewards(barbershop_id, active)` e o índice parcial de campanhas de aniversário. Preserva os índices canónicos e o índice independente `appointments(management_token_expires_at)`; o snapshot `supabase/schema.sql` foi sincronizado.
- [ ] Investigar índices sem uso antes de remover.
- [ ] Fazer profiling dos endpoints mais lentos e criar testes de carga multi-tenant.

### P2 — Qualidade e operação

- [ ] Testes reais de RLS/Data API e de isolamento entre tenants.
- [ ] Testes E2E dos fluxos de marcação, fidelização, CRM e faturação.
- [ ] Uniformizar Node 22 (CI) e Node 24 (Vercel).
- [ ] Incluir `qa:env` na CI.
- [ ] Investigar refresh-token errors e a entrada antiga na `notification_queue`.
- [ ] Fazer um teste de restauro de backup/PITR.

## Progresso desta implementação

### 1. Grants e RLS (migration aplicada; testes de isolamento aprovados)

- [x] Migration criada e revista.
- [x] Migration aplicada à produção — versão registada `20261101225911`.
- [x] Grants verificados: anon não tem SELECT/INSERT/UPDATE/DELETE em `appointments` nem acesso à tabela `users`.
- [x] Grants verificados: authenticated não pode atualizar `users.role`, `users.barbershop_id` ou `users.id`; pode atualizar campos de perfil permitidos.
- [x] Helper de permissões: EXECUTE negado a anon e autorizado a authenticated.
- [x] Política pública permissiva de UPDATE em `barbershops` removida.
- [x] Teste RLS comportamental com owner: consulta 11 marcações e 2 clientes da própria barbearia; 0 marcações e 0 clientes do outro tenant.
- [x] Testes de UPDATE dentro de transação com rollback: owner atualiza registo próprio de barbearia, cliente e marcação; não atualiza barbearia nem marcação do outro tenant.
- [x] Migration complementar `20261101230103_harden_appointment_update_rls` aplicada: permite updates a registos legados válidos e valida serviço/profissional/cliente apenas quando a referência muda.
- [x] Migration `20261101230225_move_tenant_permission_helper_private` aplicada: a função auxiliar foi movida para o schema `private`, não exposto à Data API. O advisor voltou de 15 para 14 funções `SECURITY DEFINER` executáveis por authenticated.
- [x] Migration `20261101230417_fix_loyalty_redemption_api` aplicada; a assinatura antiga de 5 argumentos foi removida. Teste com membro/recompensa reais em transação com ROLLBACK não descontou pontos nem criou resgate pendente.
- [ ] Testar reserva pública e agenda autenticada de ponta a ponta através da aplicação HTTP.
- [ ] Testes com staff sem permissão e com permissões legadas/canónicas (não há utilizadores staff ativos no dataset de produção consultado; contagem atual: 0).
- [x] Executar CI/QA completo no GitHub: run `41362234658` concluído com sucesso, incluindo TypeScript, lint, contratos, build, servidor de produção e smoke QA.

**Decisão:** o fluxo público de reservas continua a usar `/api/bookings` e o RPC atómico `create_booking_atomic`. O acesso anónimo direto à tabela de marcações deixa de ser necessário. A agenda interna continua a poder ler e alterar marcações através do cliente autenticado, mas passa a exigir uma permissão de agenda do mesmo tenant.

## Evidência de hardening aplicado e verificado

- Migration `20261101225911_harden_production_tenant_rls` aplicada à produção.
- Migration `20261101230103_harden_appointment_update_rls` aplicada à produção.
- Migration `20261101230225_move_tenant_permission_helper_private` aplicada à produção.
- Migration `20261101230417_fix_loyalty_redemption_api` aplicada à produção; a função antiga de cinco argumentos foi removida, mantendo apenas a assinatura de sete argumentos acessível a `service_role`.
- `LOYALTY_REDEMPTION_SECRET` estava configurada mas vazia. Foi substituída por uma chave aleatória e guardada como variável sensível na Vercel (production/preview); valor nunca exposto. Não existiam vouchers pendentes com tokens cifrados antes da alteração.
- Grants: anon não tem privilégios de SELECT/INSERT/UPDATE/DELETE em `appointments`, nem SELECT/INSERT em `users`.
- Grants por coluna: authenticated não pode atualizar `users.role`, `users.barbershop_id` ou `users.id`; campos de perfil permitidos mantêm UPDATE.
- Função `private.has_barbershop_permission`: execução negada a anon; permitida a authenticated para uso nas políticas RLS; a antiga função em `public` foi removida.
- Teste read-only com role authenticated (owner): own tenant permission=true; other tenant permission=false; own appointments=11, other appointments=0; own clients=2, other clients=0.
- Teste de escrita dentro de transação com rollback: own shop=1, other shop=0, own client=1, own appointment=1, other appointment=0. Nenhuma alteração ficou persistida.
- A verificação inicial de UPDATE encontrou incompatibilidade potencial com referências históricas em appointments. Foi corrigida com validação no trigger apenas quando service/professional/client são alterados.

### 3. Resultado da fase P1 — funções e grants internos

- [x] `update_barbershop_member`: apenas o owner pode alterar role/permissões; valida role, JSON object e valores booleanos; rejeita clientes CRM e owner como alvo.
- [x] `remove_barbershop_member`: apenas o owner pode remover; exige alvo da mesma barbearia e role de equipa; bloqueia owner/client; limpa permissões apenas para o tenant correspondente.
- [x] Ambas as funções usam `search_path=''`; `anon` não tem EXECUTE e `authenticated`/`service_role` mantêm EXECUTE porque a API autenticada as invoca e a autorização é validada dentro das funções.
- [x] Sete tabelas internas sem Data API: zero privilégios de `anon` e `authenticated`; `service_role` mantém SELECT/INSERT/UPDATE/DELETE.
- [x] Registo Supabase sincronizado com os ficheiros de migration: `20261101233345` e `20261101233354`.
- [x] CI `41362234658` concluída com sucesso antes da aplicação; migrations compiladas numa transação de validação com rollback antes de aplicar.
- [ ] Teste funcional com contas staff reais: não há contas staff ativas no conjunto de produção disponível.

### 4. Performance — índices de foreign keys (em curso)

- [x] Consultar advisor e confirmar que as três FKs de `appointments` sem cobertura são `client_id`, `professional_id` e `service_id`.
- [x] Rever índices existentes: `appointments_client_timeline_idx` começa por `barbershop_id` e não cobre `client_id` isoladamente; o índice GiST de sobreposição e o índice de slot não substituem índices B-tree nas FKs.
- [x] Criar migration `20261101235218_add_appointment_reference_indexes` com três índices B-tree completos (não parciais).
- [x] Adicionar contratos QA que falham se os índices forem parciais ou se faltar alguma referência, e que garantem a remoção dos quatro duplicados sem apagar índices canónicos.
- [ ] Aguardar CI; aplicar migration à produção; verificar advisor e `EXPLAIN` nos padrões de agenda/CRM.
- [ ] Rever restantes FKs por impacto e volume antes de indexar em massa. A base de produção tem poucos registos em várias tabelas; evitar criar dezenas de índices sem benefício medido.

### 4. Auditoria P1 — performance da base de dados (em curso)

- [x] Recontar os advisors após as migrations P1: 58 FKs sem índice de cobertura; 0 políticas com Auth initplan; 0 grupos de políticas permissivas duplicadas; 0 pares de índices duplicados; 72 índices sem uso.
- [x] Rever os padrões de consulta no código e os índices existentes. Em `appointments`, o índice de timeline começa por `barbershop_id` e não cobre pesquisas/FK checks por `client_id`; os índices GiST/slot também não substituem B-tree para `professional_id` e `service_id`.
- [x] Migration `20261101235218_add_appointment_reference_indexes` aplicada: adiciona B-tree completo para `appointments(client_id)`, `appointments(professional_id)` e `appointments(service_id)` e remove cinco índices redundantes comprovados.
- [x] Identificar e preparar correção para as 8 políticas com Auth initplan: shops (INSERT/UPDATE), marketing_campaigns (INSERT), barbershop_dashboard_customizations (SELECT/INSERT/UPDATE/DELETE) e subscriptions (SELECT).
- [x] Migration `20261101235220_optimize_rls_policy_initplans` aplicada: usa subqueries escalares para cache de `auth.uid()`/helper por statement, consolida as duas políticas SELECT de subscriptions preservando ambas as condições, remove políticas SELECT redundantes de reviews/services sem alterar o acesso público. Inclui também cache do helper de tenant nas políticas de escrita/consulta de services e marketing.
- [x] Validar a migration de políticas em transação com ROLLBACK; as políticas resultantes mantêm o tenant check, o acesso público e as operações permitidas.
- [x] Aplicar migrations de performance após CI e confirmar a descida dos findings: Auth initplan 8→0, políticas permissivas duplicadas 5→0, índices duplicados 4→0 e FKs sem índice 61→58.
- [ ] Rever os 58 FKs restantes por padrões de consulta/cascades antes de adicionar índices; não criar índices em massa sem evidência de workload.
- [x] Rever os pares duplicados listados acima e confirmar as definições sobreviventes e constraints associadas; migration remove apenas cinco índices redundantes com cobertura idêntica. O índice de expiração MB WAY é independente e foi explicitamente mantido.
- [ ] Rever os 72 índices sem uso; não remover com base apenas em estatísticas de uma base de dados com poucas linhas e tráfego limitado.
- [x] Consultar p95 dos últimos 7 dias. Maiores valores com pelo menos 5 pedidos: `/api/analytics` 3.0s (9 pedidos), `/api/cron/marketing` 2.9s (8), `/api/loyalty/me` 2.4s (7), `/api/marketing/campaigns/automation` 2.1s (6), `/api/barbershops/public-profile` 2.1s (27), `/api/shops/[id]/booking-data` 1.8s (55). Sem respostas 5xx nesses grupos; amostras pequenas em vários endpoints.
- [x] Confirmar que as tabelas de negócio consultadas continuam pequenas no ambiente atual (ex.: appointments 11 linhas estimadas; services 4). Isto limita conclusões de EXPLAIN e impede afirmar ganhos de latência antes de um teste de carga real.

### 5. RLS — otimização de initplans e consolidação (aplicada)

- [x] Rever as policies atuais de `shops`, `services`, `marketing_campaigns`, `barbershop_dashboard_customizations`, `subscriptions` e `reviews` antes de alterar.
- [x] Confirmar que a migration `20261101235220_optimize_rls_policy_initplans` preserva as condições de acesso e combina políticas permissivas equivalentes com `OR`.
- [x] Adicionar contratos QA para chamadas Auth/helper em initplan e para consolidação das policies.
- [x] CI `41363911617` passou integralmente; migrations de índices e RLS aplicadas à produção. Advisor confirmou zero findings de initplan, políticas permissivas duplicadas e índices duplicados, mantendo o acesso público/tenant.

## Evidência de produção observada

- Supabase PostgreSQL 17, região `eu-west-1`, estado `ACTIVE_HEALTHY`.
- 14 funções `SECURITY DEFINER` preexistentes assinaladas como executáveis por authenticated (o helper novo está no schema `private`).
- 33 tabelas RLS sem policies.
- 58 foreign keys sem índices de cobertura (eram 61 antes da otimização de `appointments`).
- 0 políticas com chamadas Auth sinalizadas como initplan (eram 8 antes da otimização).
- 0 grupos de políticas permissivas duplicadas (eram 5 antes da consolidação).
- 0 pares de índices duplicados (eram 4 grupos sinalizados pelo advisor; cinco índices redundantes removidos, incluindo um prefixo redundante adicional).
- Workers de booking automation, booking completion e MB WAY expiry ativos e sem falhas nos 7 dias analisados.
- Deploy atual da Vercel estava `READY` durante a auditoria.

## Regras para fechar cada item

1. Corrigir o problema na base de dados ou no servidor, nunca apenas esconder UI.
2. Adicionar teste de regressão que falhe antes da correção e passe depois.
3. Rever os fluxos existentes para evitar regressões legítimas.
4. Confirmar estado de produção e atualizar a issue e este documento.
5. Só marcar concluído com evidência verificável.

## Revalidação live — 5 de novembro de 2026

Consulta aos Supabase advisors do projeto de produção (`ACTIVE_HEALTHY`, PostgreSQL 17, `eu-west-1`). Esta fotografia complementa — não substitui — a auditoria de 1 de novembro.

### Findings atuais

- [ ] Auth: leaked-password protection continua desativada. Ativar em Supabase Auth > Password Security; requer configuração no dashboard, não migration.
- [ ] Performance: advisor reporta 50 foreign keys sem índice de cobertura. Priorizar por volume, consultas e ações de cascade; não criar índices em massa sem medir.
- [ ] Segurança: advisor reporta 14 funções `SECURITY DEFINER` executáveis por `authenticated`. A revisão anterior documenta validações internas e `search_path` fixo; revalidar grants e definições atuais antes de alterar.
- [ ] Segurança: advisor reporta 37 tabelas com RLS ativo e sem policies. Muitas são server-only/intencionais; confirmar grants de `anon`/`authenticated` e acesso `service_role` tabela a tabela. Não adicionar policies genéricas.
- [ ] Performance: rever índices assinalados como não utilizados apenas após período representativo de tráfego; estatísticas isoladas não justificam remoção.

### Interpretação e próximos passos

- Os findings do advisor são sinais para revisão, não prova automática de vulnerabilidade ou lentidão.
- Não foi aplicada nenhuma alteração à produção durante esta revalidação.
- Próxima ação segura: exportar inventário de constraints, índices, grants e definições das 14 funções; cruzar com migrations e contratos QA antes de preparar uma migration.
- Validar leaked-password protection no dashboard e depois confirmar o estado no advisor.


## Revalidação e remediação — 15 de novembro de 2026

Revalidação da produção: Supabase `yzrdpwsfqsazxvwsjobf` (`eu-west-1`), GitHub `main` e Vercel.

### Regressões confirmadas e correções preparadas

- [x] **Convites de equipa — SQLSTATE 42702:** `join_barbershop_with_invite` tinha a referência `role` ambígua entre a coluna e a variável de saída de `RETURNS TABLE`. A migration `20261115153000_fix_production_audit_regressions` qualifica `users.role` pelo alias `u`.
- [x] **Lembretes de expiração — SQLSTATE 42702:** `claim_subscription_expiry_reminder_events` usava `ON CONFLICT (subscription_id, period_end, days_before)`, colidindo com os parâmetros de saída. A migration passa a usar a constraint `subscription_expiry_reminder_outbox_once`.
- [x] **SECURITY DEFINER — EXECUTE anónimo:** a mesma migration revoga EXECUTE de `anon` em `set_manual_booking_auto_confirmation`, retira execução direta da função trigger e revoga EXECUTE de `PUBLIC`/`anon` por omissão para novas funções em `public` criadas por `postgres` (owner das migrations da aplicação). O papel `supabase_admin` não é membro do owner `postgres` e os seus defaults são geridos pelo Supabase, por isso não são alterados. A chamada autenticada de owner/admin continua permitida.
- [x] **Fila antiga de notificações:** o trigger produtor `trigger_notify_new_review` não tinha consumidor no código atual. A migration desliga o produtor para evitar acumulação adicional; os quatro registos existentes são preservados, sem DELETE/UPDATE.
- [x] Adicionado contrato QA `qa:production-hardening` para bloquear regressões nestes pontos.

Migration aplicada em produção a 15/11 depois de CI passar. Os advisors e as permissões foram novamente consultados depois da aplicação.

### Itens ainda dependentes de acesso/configuração ou workload

- **Leaked Password Protection:** continua por ativar. Requer configuração em Supabase Auth > Password Security; a ligação atual não expõe uma ação de atualização Auth segura.
- **Marketing Cron e Support Email Retry Cron:** os workflows falharam, mas não foi possível obter os logs do job nem verificar a correspondência do secret GitHub Actions com a variável da Vercel. Não assumir que a causa é o secret; é necessária confirmação sem revelar o seu valor.
- **Índices:** 50 foreign keys sem índice de cobertura e 74 índices sem utilização. Não criar/remover índices em massa sem workload representativo, análise de cascades e EXPLAIN.
- **Extensões em public:** `btree_gist` e `pg_net` continuam a exigir revisão de relocatabilidade e dependências antes de alterar schema.
- **Testes comportamentais RLS/staff:** não há contas staff ativas no dataset de produção consultado; executar em ambiente de teste com fixtures isoladas.
- **PITR:** teste de restauro continua por executar.
- **Notification queue:** os registos antigos ficam preservados até decisão explícita sobre retenção/eliminação.
- **Refresh tokens:** não foi observado reuse; há eventos históricos de refresh token inválido, compatíveis com sessões expiradas. Continuar monitorização.

Não marcar os itens dependentes de validação/configuração como concluídos sem evidência.


## Seguimento — CI/runtime e auditoria de 15 de novembro de 2026

- [x] Corrigidas em produção as ambiguidades SQLSTATE 42702 em `join_barbershop_with_invite` e `claim_subscription_expiry_reminder_events`.
- [x] Revogado EXECUTE anónimo na RPC de confirmação manual e removido EXECUTE direto de clientes na função trigger.
- [x] Revogado EXECUTE de PUBLIC/anon por omissão para novas funções no schema `public` criadas pelo owner `postgres`.
- [x] Desativado o trigger órfão de novas-review notifications; os quatro registos pendentes foram preservados.
- [x] PR #271 merged; migration `20261115154352` confirmada no histórico remoto de produção.
- [x] PR #269 merged; inclui notificações ao barbeiro em cancelamento/reagendamento do cliente e email ao cliente em reagendamento pelo barbeiro.
- [x] Contratos QA de hardening passaram; CI, build e smoke QA passaram no run `43731029145`.
- [x] Deploy manual da versão merged; deployment `dpl_B3UDXPvnrx1CesmRuzDCzB7DyiYc` READY para `899ba60347dbec2b3abcc05c4ba1ba3fbca9653f`, alias `barbers.silentra.me` confirmado.
- [x] Identificados no Vercel os nomes de todas as variáveis exigidas por `qa:env` em produção, sem ler nem expor valores.
- [x] `qa:env` completo fica deliberadamente reservado a um ambiente de produção/local com valores reais; não corre no pull_request CI com placeholders. A CI valida estaticamente o contrato através de `qa:env-contract`, sem injetar secrets.
- [x] Atualizar runner CI para Node.js 24.x, alinhado com o runtime de produção Vercel (PR de CI separado).
- [x] Confirmado bloqueio de plano para Leaked Password Protection: organização Supabase `Silentra` está em `tier_free`; a funcionalidade HaveIBeenPwned está disponível apenas a partir de Pro. Sem upgrade não pode ser ativada; alternativa gratuita: configurar comprimento mínimo e requisitos de caracteres em Authentication → Sign In / Providers → Email.
- [ ] Confirmar que o secret `CRON_SECRET` em GitHub Actions coincide com o valor de produção Vercel. O nome existe em Vercel; não foi possível inspecionar o secret GitHub através da ligação disponível.
- [ ] Confirmar execução dos workflows GitHub Actions Marketing Cron e Support Email Retry Cron numa execução agendada/manual. Não há logs destas rotas na última meia hora e esta ligação não expõe o histórico geral dos workflows; os schedules correm no GitHub Actions, não no Vercel Cron.
- [ ] Analisar 50 FKs sem índice de cobertura e 74 índices sem uso quando existir workload suficiente; não adicionar/remover índices sem evidência.
- [ ] Avaliar relocação de `btree_gist` após análise das dependências; `pg_net` não é relocável.
- [ ] Executar teste de restauro PITR num ambiente de recuperação dedicado e testes E2E com fixtures staff em ambiente seguro.
- [x] Rever as falhas históricas de email de cancelamento e melhorar a telemetria no PR #273; o código atual já diferencia configuração, input inválido, HTTP do Brevo e falha de rede. A causa específica dos 26 eventos antigos não pode ser reconstruída porque o log antigo não guardava esse detalhe.


## Verificação final — 15 de novembro de 2026 (15:00–16:00 UTC)

### Concluído e verificado em produção

- [x] PR #269 merged: emails ao cliente quando o barbeiro reagenda; emails e notificações ao barbeiro quando o cliente cancela ou reagenda.
- [x] PR #271 merged; migration `20261115154352_fix_production_audit_regressions` aplicada no Supabase de produção.
- [x] `join_barbershop_with_invite`: referência `users.role` qualificada; `anon` não executa, `authenticated` executa.
- [x] `claim_subscription_expiry_reminder_events`: conflito usa a constraint nomeada; execução reservada a `service_role`. Chamada dentro de transação revertida passou sem erro.
- [x] `join_barbershop_with_invite`: teste transacional com JWT subject sintético devolveu o erro de validação esperado (`invalid_code`), sem SQLSTATE 42702 e com ROLLBACK.
- [x] `set_manual_booking_auto_confirmation`: execução anónima removida; autenticados mantidos.
- [x] `apply_manual_booking_confirmation_setting`: continua associado ao trigger de INSERT em appointments, mas sem EXECUTE direto para qualquer role cliente.
- [x] Defaults de funções do owner `postgres` em `public`: sem EXECUTE de PUBLIC/anon para novas funções.
- [x] Auditoria das RPCs SECURITY DEFINER: 17 funções executáveis por `authenticated`, 0 por `anon`; as 17 incluem `auth.uid()` e têm `search_path` fixo. Os endpoints e verificações de tenant/role foram revistos, incluindo onboarding, convites, equipa, agenda, MB WAY e configuração.
- [x] Trigger `trigger_notify_new_review` desativado. A tabela contém apenas 4 entradas antigas `new_review`; nenhuma foi eliminada. A aplicação não contém consumidor para esse tipo de entrada.
- [x] PR #272 merged: CI usa Node.js 24.x, alinhado com Vercel; foi acrescentado `qa:env-contract` sem colocar secrets de produção em runners de PR.
- [x] CI #3154 passou: TypeScript, lint, environment contracts, build e smoke QA.
- [x] Deploy production `dpl_5bsbrvhDppQWQNWhh6jfU6xr6v1i` READY para o commit `8fc9cd6696bad94311bdce739a8ebbb4b40c52d4`.
- [x] Deploy final production `dpl_B3UDXPvnrx1CesmRuzDCzB7DyiYc` READY para o commit `899ba60347dbec2b3abcc05c4ba1ba3fbca9653f`; alias `barbers.silentra.me` confirmado neste deployment.
- [x] Erros de pré-pagamento MB WAY foram anteriores à migration `20261113174136_restore_mbway_prepayment_booking_rpc`; a função atual mantém `prepayment_pending`, método, estado, valor e expiração.
- [x] Os pedidos manuais de subscrição atualmente existentes estão pagos; não há pedidos PENDING/PAYMENT_SENT pendentes na fotografia consultada. O erro histórico `MANUAL_SUBSCRIPTION_NOT_FOUND` foi uma recusa de segurança para uma subscrição manual inválida/stale e não foi reproduzido na situação atual.
- [x] Auditoria Auth: 7 refresh-token requests no intervalo recente terminaram em HTTP 200. Os erros históricos `refresh_token_not_found` não voltaram a aparecer no intervalo consultado; último evento conhecido em 12/11.
- [x] Vercel: sem runtime errors na última hora consultada.
- [x] RLS: as 38 tabelas públicas com RLS ativo e sem policies foram verificadas uma a uma; nenhuma tem SELECT/INSERT/UPDATE/DELETE concedido a `anon` ou `authenticated`, e todas mantêm acesso `service_role`.

### Em curso / requer validação posterior

- [x] PR #273 merged e deployed: o transporte Brevo devolve códigos de falha categorizados (configuração, input, HTTP status, rede); cancelamentos registam apenas `appointmentId`, `reasonCode` e existência de destinatário, sem PII. A causa das 26 falhas históricas (11–13/11) não é recuperável porque os logs antigos só guardavam um marcador genérico. Não foi enviado email de teste nem reenviado email a clientes.
- [ ] Confirmar o próximo run diário do `subscription-expiry-reminders` (agendado às 00:25 UTC) com HTTP 200; a função SQL já foi exercitada sem erro numa transação revertida.
- [ ] Confirmar que o GitHub Actions secret `CRON_SECRET` corresponde ao valor de produção da Vercel. O nome existe nas variáveis Vercel, mas esta integração não permite ler/verificar GitHub Actions secrets.
- [ ] Confirmar execução dos workflows GitHub Actions Marketing Cron e Support Email Retry Cron numa execução agendada/manual. Não há logs destas rotas na última meia hora e esta ligação não expõe o histórico geral dos workflows; os schedules correm no GitHub Actions, não no Vercel Cron.
- [x] Leaked Password Protection permanece bloqueada pelo plano Free da organização; não existe ação de configuração Auth no conector. É necessário upgrade para Pro para ativar a verificação HaveIBeenPwned.
- [ ] Testes E2E reais de booking, billing, CRM e staff por tenant; não existem contas staff de teste em produção. Executar com fixtures isoladas num ambiente de teste.
- [ ] Teste de restauro PITR num projeto/ambiente dedicado.
- [ ] Rever 50 FKs sem cobertura e 74 índices sem utilização após recolha de workload representativo. Não indexar/remover em massa.
- [ ] Avaliar btree_gist; pg_net é não relocável e não deve ser movido.
- [ ] Configurar `SENTRY_AUTH_TOKEN` para que os source maps/releases sejam enviados ao Sentry; o build atual passou, mas o upload foi ignorado por falta de token. A variável não consta da lista de envs de produção.


## Revalidação e remediação — 22 de novembro de 2026

### P1 — leitura pública de barbershops (correção preparada)

- [x] Confirmado em produção que `barbershops_public_read` usa `USING (true)` para `anon` e `authenticated`.
- [x] Confirmados grants de tabela excessivos para `anon` e `authenticated`, incluindo INSERT/UPDATE/DELETE e privilégios adicionais; a tabela contém 32 colunas, incluindo metadados internos como `created_by`, `qr_code_text` e `calendar_feed_version`.
- [x] Confirmado que o resolver de perfis públicos, páginas Enterprise e disponibilidade usam `createAdminClient()`; o Data API anónimo direto não é necessário para estes fluxos.
- [x] Preparada a migration `20261122134500_restrict_public_barbershop_read.sql`: revoga grants de tabela/coluna de anon e authenticated, concede apenas as colunas necessárias ao dashboard autenticado, permite UPDATE direto apenas da morada e substitui a policy pública por uma policy de leitura limitada a membros staff do mesmo tenant.
- [x] Removidos métodos legados sem utilização que consultavam `barbershops` com `SELECT *` no serviço de clientes.
- [x] Adicionados contratos QA para grants, policy tenant-scoped e manutenção dos fluxos públicos server-side.
- [x] Dry-run da migration executado em produção dentro de uma transação revertida: 11 verificações de privilégios/policies passaram; uma segunda consulta confirmou que os grants e a policy de produção permaneceram inalterados após ROLLBACK.
- [x] CI completa concluída com sucesso no GitHub Actions run #3454 (job Quality + Production Hardening): typecheck, lint, contratos QA, build e smoke QA sem falhas.
- [ ] Atualizar a branch se necessário, obter revisão final e integrar o PR; aplicar a migration em produção e validar os fluxos autenticados/públicos apenas após autorização explícita.

### Outros findings confirmados / pendentes

- [x] Security Advisor: 21 funções SECURITY DEFINER executáveis por authenticated; 0 executáveis por anon. A função `create_barbershop_invite_code` delega para `create_barbershop_invite_v2`, que valida `auth.uid()` e exige owner/admin do tenant. As funções analisadas têm `search_path` fixo e os roles cliente não têm CREATE nos schemas `public`/ `extensions`.
- [ ] Leaked Password Protection continua desativada; a integração de gestão disponível não expõe a configuração Auth necessária.
- [ ] Configurar `SENTRY_AUTH_TOKEN` no ambiente Vercel; requer um token de projeto Sentry fornecido/configurado pelo owner, não deve ser inventado nem registado em código.
- [ ] Rever refresh-token errors com logs correlacionados da Vercel/Auth e testar a recuperação de sessão.
- [ ] Profiling por workload para as 50 FKs sem cobertura e os 71 índices sem uso; não remover/adicionar índices em massa.
- [ ] Testes reais com staff de permissões distintas, testes E2E multi-tenant e teste de restauro PITR.


### Remediação adicional após dry-run (22/11/2026)

- [x] Removido `mbway_phone` da allowlist SELECT de `authenticated`. A configuração sensível é agora lida através de `/api/barbershops/mbway-settings`, que exige utilizador autenticado com role `owner` ou `admin` e resolve sempre o tenant a partir do perfil autenticado.
- [x] Migradas as leituras públicas de `POST /api/bookings`, `GET /api/shops` (diretório) e `GET /api/shops/[id]/slots` para `createAdminClient()`, sem remover a filtragem de visibilidade do diretório nem bloquear a marcação através de links diretos.
- [x] Novo dry-run da migration com JWT de um utilizador autenticado, seguido de ROLLBACK: uma barbearia visível, próprio perfil visível, zero barbearias de outros tenants; `created_by`, `qr_code_text` e `mbway_phone` não legíveis; `anon` sem SELECT na tabela. A produção ficou inalterada.
- [x] Confirmado no código que os três fluxos normais de logout chamavam `auth.signOut()` sem scope. O scope JavaScript predefinido é `global` e revoga refresh tokens de todas as sessões, o que pode produzir `refresh_token_not_found` noutros dispositivos/abas. Alterados os fluxos de logout para `{ scope: 'local' }` e acrescentados contratos QA. Isto é uma correção preventiva plausível para os quatro erros históricos de um utilizador, mas a correlação com o utilizador afetado não foi demonstrada.
- [ ] Confirmar CI completa no commit após as correções de MB WAY, rotas públicas e logout local.
- [ ] Testar E2E com owner, admin e staff sem acesso a MB WAY, e com duas barbearias em ambiente isolado.

### Profiling de performance — produção (22/11/2026)

- [x] Consultados `pg_stat_user_tables`, `pg_stat_user_indexes` e `pg_stat_statements`; advisors continuam a reportar 50 FKs sem índice de cobertura e 71 índices sem utilização.
- [x] As tabelas apontadas pelo advisor são atualmente pequenas (maior tamanho observado entre as amostras: 128 kB; `booking_waitlist_vacancies`: 33 linhas estimadas; `appointments`: 113; `users`: 29). Os índices sinalizados consultados têm 16 kB cada e zero scans no período estatístico disponível.
- [x] Não foram adicionados nem removidos índices. Não existe evidência suficiente para indexar 50 FKs ou remover 71 índices; alguns índices de baixa frequência protegem caminhos de billing, tokens, expiração ou filas. Reavaliar após workload real e crescimento de dados.
- [x] `claim_booking_waitlist_vacancies`: 13.008 chamadas e média ~14,3 ms em `pg_stat_statements`; `get_crm_clients_page`: 51 chamadas e média ~9,8 ms. Os P95 anteriormente observados no PostgREST têm amostras pequenas e não são prova isolada de query lenta.
- [ ] Continuar a recolher métricas de tráfego real e analisar `EXPLAIN (ANALYZE, BUFFERS)` com consultas representativas num ambiente seguro.

### Pendências externas/configuração

- [ ] Leaked Password Protection: requer upgrade do projeto/organização para Supabase Pro; não existe ação de configuração Auth disponível através da ligação atual.
- [ ] Sentry: falta `SENTRY_AUTH_TOKEN` para upload de source maps/releases. Configurar privadamente em Vercel/Sentry; não colocar o token no repositório ou em comentários.
- [ ] Não foi possível correlacionar individualmente os refresh-token errors históricos com um evento de logout; a mudança para scope local previne a invalidação acidental de sessões independentes, mas a monitorização deve continuar.



### Sincronização da migration Marketing Cron — 22/11/2026

- [x] Confirmado em produção que o job `silentra-marketing` está ativo a cada 5 minutos, assina os pedidos com HMAC a partir de segredos do Vault e chama `/api/cron/marketing`.
- [x] Histórico das últimas 24 horas: 18 execuções com sucesso, 0 falhadas; última execução observada às 15:35 UTC com conclusão normal.
- [x] Confirmado que a versão aplicada em produção é `20261122140747_schedule_marketing_cron`.
- [x] Renomeada a migration do repositório de `20261122134000` para `20261122140747`, preservando o SQL aplicado, e atualizadas as referências em `docs/CRON.md`, `scripts/qa/feature-workflows.mjs` e `scripts/qa/product-contracts.mjs`.
- [ ] Não reaplicar esta migration em produção: está registada como aplicada. Confirmar apenas que a sincronização GitHub/produção é reconhecida pelo Supabase CLI durante o próximo workflow de migrations, sem executar um novo push nesta fase.
