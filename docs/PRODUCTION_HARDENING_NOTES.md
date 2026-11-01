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
- [ ] Rever as funções `SECURITY DEFINER` sinalizadas e restringir EXECUTE.
- [ ] Ativar leaked-password protection.
- [ ] Rever 33 tabelas RLS sem policies, separando tabelas internas server-only das tabelas acessíveis por clientes.
- [x] Aplicar e sincronizar a migration de fidelização `20261101230417_fix_loyalty_redemption_api`.
- [ ] Consolidar políticas permissivas duplicadas.
- [ ] Corrigir chamadas de Auth em políticas com initplan.

### P1 — Performance
- [ ] Rever as 61 foreign keys sem índices de cobertura.
- [ ] Rever 4 pares de índices duplicados.
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
- [ ] Testar reserva pública e agenda autenticada de ponta a ponta através da aplicação HTTP.
- [ ] Testes com staff sem permissão e com permissões legadas/canónicas (não há utilizadores staff ativos no dataset de produção consultado).
- [ ] Executar CI/QA completo no GitHub e rever advisors finais. Os advisors atuais já não sinalizam a função auxiliar como RPC pública; permanecem 14 funções preexistentes a rever.

**Decisão:** o fluxo público de reservas continua a usar `/api/bookings` e o RPC atómico `create_booking_atomic`. O acesso anónimo direto à tabela de marcações deixa de ser necessário. A agenda interna continua a poder ler e alterar marcações através do cliente autenticado, mas passa a exigir uma permissão de agenda do mesmo tenant.

## Evidência de hardening aplicado e verificado

- Migration `20261101225911_harden_production_tenant_rls` aplicada à produção.
- Migration `20261101230103_harden_appointment_update_rls` aplicada à produção.
- Migration `20261101230225_move_tenant_permission_helper_private` aplicada à produção.
- Migration `20261101230417_fix_loyalty_redemption_api` aplicada à produção; a função antiga de cinco argumentos foi removida, mantendo apenas a assinatura de sete argumentos acessível a `service_role`.
- Grants: anon não tem privilégios de SELECT/INSERT/UPDATE/DELETE em `appointments`, nem SELECT/INSERT em `users`.
- Grants por coluna: authenticated não pode atualizar `users.role`, `users.barbershop_id` ou `users.id`; campos de perfil permitidos mantêm UPDATE.
- Função `private.has_barbershop_permission`: execução negada a anon; permitida a authenticated para uso nas políticas RLS; a antiga função em `public` foi removida.
- Teste read-only com role authenticated (owner): own tenant permission=true; other tenant permission=false; own appointments=11, other appointments=0; own clients=2, other clients=0.
- Teste de escrita dentro de transação com rollback: own shop=1, other shop=0, own client=1, own appointment=1, other appointment=0. Nenhuma alteração ficou persistida.
- A verificação inicial de UPDATE encontrou incompatibilidade potencial com referências históricas em appointments. Foi corrigida com validação no trigger apenas quando service/professional/client são alterados.

## Evidência de produção observada
- Supabase PostgreSQL 17, região `eu-west-1`, estado `ACTIVE_HEALTHY`.
- 14 funções `SECURITY DEFINER` preexistentes assinaladas como executáveis por authenticated (o helper novo está no schema `private`).
- 33 tabelas RLS sem policies.
- 61 foreign keys sem índices de cobertura.
- 19 políticas com chamadas Auth reavaliadas por linha.
- 14 grupos de políticas permissivas duplicadas na auditoria inicial; após as correções restam 5 grupos, apenas em reviews, services e subscriptions.
- 4 pares de índices duplicados.
- Workers de booking automation, booking completion e MB WAY expiry ativos e sem falhas nos 7 dias analisados.
- Deploy atual da Vercel estava `READY` durante a auditoria.

## Regras para fechar cada item
1. Corrigir o problema na base de dados ou no servidor, nunca apenas esconder UI.
2. Adicionar teste de regressão que falhe antes da correção e passe depois.
3. Rever os fluxos existentes para evitar regressões legítimas.
4. Confirmar estado de produção e atualizar a issue e este documento.
5. Só marcar concluído com evidência verificável.
