# Silentra for Barbers — Production Hardening Notes

**Auditoria inicial:** 1 de novembro de 2026  
**Issue de acompanhamento:** [#157 — Production hardening](https://github.com/martimfm1/silentra-for-barbers/issues/157)  
**Branch de trabalho:** `fix/production-hardening-p0`

Este documento é o bloco de notas persistente da auditoria. A issue contém os critérios de conclusão; aqui fica o histórico técnico, decisões e progresso.

## Resumo da auditoria

### P0 — Segurança e isolamento
- [ ] Remover acesso anónimo direto a `appointments` (SELECT/INSERT/UPDATE/DELETE).
- [ ] Restringir SELECT/INSERT/UPDATE/DELETE de marcações a staff do tenant com permissões `agenda` / `appointments`.
- [ ] Bloquear updates de `users.role`, `users.barbershop_id`, `users.id` e timestamps através do Data API.
- [ ] Limitar CRUD da tabela `users` a dados CRM de clientes no tenant, sem permitir alteração de roles.
- [ ] Remover políticas permissivas de UPDATE de `barbershops`; apenas owner/admin do tenant podem atualizar.
- [ ] Adicionar testes de regressão para os limites de grants e RLS.

### P1 — Supabase, Auth e migrations
- [ ] Rever as funções `SECURITY DEFINER` sinalizadas e restringir EXECUTE.
- [ ] Ativar leaked-password protection.
- [ ] Rever 33 tabelas RLS sem policies, separando tabelas internas server-only das tabelas acessíveis por clientes.
- [ ] Aplicar e sincronizar a migration de fidelização `20261101213122_fix_loyalty_redemption_api`.
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

### 1. Grants e RLS (em preparação)
- [ ] Migration criada e revista.
- [ ] Migration aplicada à produção.
- [ ] Advisors de segurança reavaliados.
- [ ] Testes de leitura/escrita anónima confirmados.
- [ ] Testes de atualização de role/tenant confirmados.
- [ ] Fluxos de reserva pública e agenda autenticada confirmados.

**Decisão:** o fluxo público de reservas continua a usar `/api/bookings` e o RPC atómico `create_booking_atomic`. O acesso anónimo direto à tabela de marcações deixa de ser necessário. A agenda interna continua a poder ler e alterar marcações através do cliente autenticado, mas passa a exigir uma permissão de agenda do mesmo tenant.

## Evidência de produção observada
- Supabase PostgreSQL 17, região `eu-west-1`, estado `ACTIVE_HEALTHY`.
- 14 funções `SECURITY DEFINER` assinaladas como executáveis por authenticated.
- 33 tabelas RLS sem policies.
- 61 foreign keys sem índices de cobertura.
- 19 políticas com chamadas Auth reavaliadas por linha.
- 14 grupos de políticas permissivas duplicadas.
- 4 pares de índices duplicados.
- Workers de booking automation, booking completion e MB WAY expiry ativos e sem falhas nos 7 dias analisados.
- Deploy atual da Vercel estava `READY` durante a auditoria.

## Regras para fechar cada item
1. Corrigir o problema na base de dados ou no servidor, nunca apenas esconder UI.
2. Adicionar teste de regressão que falhe antes da correção e passe depois.
3. Rever os fluxos existentes para evitar regressões legítimas.
4. Confirmar estado de produção e atualizar a issue e este documento.
5. Só marcar concluído com evidência verificável.
