# Silentra for Barbers — Production Readiness

> Release branch: `production-hardening`

## P0 — Quality gate

- [x] `package.json` alinhado com `pnpm-lock.yaml` nas dependências corrigidas.
- [x] CI usa `pnpm install --frozen-lockfile`.
- [x] TypeScript (`pnpm typecheck`) definido na CI.
- [x] ESLint (`pnpm lint`) definido na CI.
- [x] Production build (`pnpm build`) definido na CI.
- [x] Smoke QA definido e ligado ao servidor de produção local da CI.
- [x] Health endpoint `/api/health` implementado e incluído no smoke test.
- [x] Contratos de planos automatizados.
- [x] Auditoria estática de segurança automatizada.
- [x] Auditoria de dependências disponível via `pnpm qa:deps`.
- [ ] Executar e evidenciar todos os comandos localmente / na CI.
- [ ] Validar migrations do Supabase em staging antes de produção.
- [ ] Validar variáveis de ambiente obrigatórias por ambiente.

## P1 — Segurança e dados

- [x] RLS canónico presente nas tabelas core.
- [x] Helpers `SECURITY DEFINER` críticos têm `search_path` explícito.
- [x] `role` e `barbershop_id` do utilizador estão protegidos server-side/database.
- [x] Índice parcial único protege active double-booking na database.
- [ ] Confirmar em staging que a disponibilidade é calculada por profissional e que dois profissionais podem atender em paralelo.
- [x] Converter conflito de concorrência `23505` em HTTP 409.
- [ ] Teste real de isolamento multi-tenant A → A permitido / A → B recusado.
- [ ] Auditar todas as funções `SECURITY DEFINER` da migration history.
- [ ] Testar Free/Pro/Enterprise na API e database.
- [ ] Testar quota Free de 1 profissional sob concorrência.
- [ ] Validar Storage por tenant e conversão de avatar para WebP.
- [x] Parser comum server-side para JSON: Content-Type, limite de bytes, JSON válido, objeto e allowlist de campos.
- [x] Booking público e criação autenticada de marcações: allowlist estrita e validação cruzada de barbearia/serviço/profissional contra registos server-side; criação atómica na base de dados.
- [x] Subscrições: allowlist estrita, intervalo rejeitado se inválido, proprietário verificado, subscrição atual reconsultada e preço resolvido no servidor.
- [x] Registo de conta: allowlist estrita e validação server-side de email, palavra-passe, nome e telefone.
- [x] Tracking privado de encomendas: Content-Type obrigatório, limite de corpo, apenas campo token, token validado e hash consultado no servidor.
- [x] Login e redefinição de palavra-passe: allowlist estrita e sessão validada pelo Supabase antes de alterar credenciais.
- [x] CRM tags e relatórios Enterprise: allowlist estrita e associação ao tenant obtida no servidor.
- [x] Alteração do estado de encomendas, emails manuais de encomendas, avatar e ações de faturação manual no admin: allowlists específicas e verificação de contexto/autorização no servidor.
- [x] Definições do marketplace, consulta pública do perfil de cliente de marcação, validação de resgates Loyalty e criação/edição de regras de pontos: allowlists específicas, limites de corpo e validação do tenant/identificadores no servidor.
- [x] Criação/edição de recompensas Loyalty: allowlist estrita, validação de tipo/valores e atualização limitada à barbearia autenticada.
- [x] Regras de automação, definições do código QR e saída do programa Loyalty: allowlists específicas, limites de corpo e validação server-side de campos/contexto.
- [x] Inventário Enterprise, localizações e comissões: allowlists específicas, limites de corpo, valores numéricos limitados e validação de localização/profissional contra o tenant autenticado.
- [x] Pedidos/verificação de códigos do portal de clientes e OTP da fidelização, e resgate Loyalty: allowlists estritas, limites de corpo e rate limiting/verificação de sessão ou tenant server-side.
- [ ] Aplicar o parser comum ou validação equivalente a todos os endpoints mutáveis; inventário completo e testes negativos por rota ainda pendentes.
- [ ] Revalidar permissões e propriedade dos recursos dentro da mesma transação/RPC para todas as operações sensíveis; validação client-side nunca conta como controlo de segurança.
- [ ] Completar auditoria de rate limiting dos restantes endpoints públicos e de mensagens.
- [x] Rate limiting do fluxo público de reviews.
- [ ] Error tracking externo/alertas.
- [x] Logs estruturados com redação de campos sensíveis; detalhes de erro do webhook Stripe são persistidos apenas como identificadores.
- [ ] Auditar CSP/CORS em produção.
- [x] `allowedDevOrigins` limitado ao modo de desenvolvimento.

## P1 — Reviews / abuso

- [x] Remover a policy pública de reviews com `WITH CHECK (true)` através de migration corretiva; validar a migration em staging antes de produção.
- [x] Token de avaliação aleatório, guardado como hash, associado a marcação concluída, expira em 30 dias e só pode ser usado uma vez; validar o fluxo em staging.
- [x] RPC valida marcação concluída, tenant/barbearia e token não expirado/não consumido; confirmar testes negativos em staging.
- [x] Rate limiting distribuído no fluxo público de reviews (5 pedidos/hora por IP e barbearia); token de marcação concluída implementado, aguarda validação em staging.

## P1 — Billing

- [ ] Upgrade Free → Pro.
- [ ] Upgrade Pro → Enterprise.
- [ ] Cancelamento e fim do período.
- [ ] Falhas de pagamento.
- [x] Ledger idempotente de webhook com claim/lease/complete; a execução de eventos duplicados continua a exigir teste em staging.
- [ ] Price ID → entitlement server-side.
- [ ] Não confiar no plano enviado pelo cliente.
- [ ] Testar eventos Stripe duplicados.

## P1 — Booking / CRM

- [ ] Criar marcação pública.
- [x] DB impede double booking activo para o mesmo slot/profissional.
- [ ] Impedir double booking concorrente na API + DB.
- [ ] Confirmar marcação.
- [ ] Concluir serviço.
- [ ] Adicionar cliente à CRM.
- [ ] Reutilizar cliente existente por telefone.
- [ ] Impedir acesso cross-tenant.
- [ ] Testar dois profissionais diferentes no mesmo horário.

## P2 — Comunicação

- [ ] Confirmar templates com `{{nome}}`, `{{barbearia}}` e `{{booking_url}}`.
- [ ] Validar avatar nos emails.
- [ ] Testar aniversário, confirmação, cancelamento e mensagem manual.
- [ ] Validar domínio/sender da Brevo.
- [ ] Confirmar SPF/DKIM/DMARC.
- [ ] Garantir que falha de email não falha a operação principal.

## P2 — Plataforma

- [x] Staging/production são tratados como ambientes distintos no plano.
- [x] Health check implementado.
- [ ] Backups e recuperação testados.
- [ ] Monitoring e alertas.
- [ ] Error tracking.
- [x] Request/correlation IDs (`x-request-id`) nos handlers com observabilidade.
- [ ] Security headers auditados.
- [x] `allowedDevOrigins` limitado ao desenvolvimento.
- [ ] Performance e Core Web Vitals.
- [ ] Mobile e acessibilidade.
- [ ] SEO / sitemap / canonical / metadata.
- [ ] Rollback documentado.
- [ ] RPO/RTO definidos.

## P2 — Auth / onboarding

- [ ] Login/logout.
- [ ] Session refresh / expiry.
- [ ] Password recovery.
- [ ] Email verification.
- [ ] Onboarding → primeira marcação.
- [ ] Sem loops de redirect.

## P2 — Legal / GDPR

- [ ] Revisão jurídica final da Política de Privacidade e dos Termos PT/EN (as páginas de rascunho já existem).
- [ ] Cookie/consentimento quando aplicável.
- [ ] Aprovar prazos de retenção e eliminação por categoria.
- [ ] Implementar e testar eliminação de conta/dados.
- [ ] Implementar e testar exportação de dados.
- [ ] Finalizar DPA e lista real de subprocessadores.
- [ ] Validar consentimento de cookies/analytics por rota.
- [ ] Executar e documentar processo de pedidos de titulares.
- [ ] Revisão jurídica antes do lançamento comercial.

## Documentação operacional

- [Runbook de operações e recuperação](./PRODUCTION_OPERATIONS.md)
- [Operações de privacidade e RGPD](./GDPR_OPERATIONS.md)

## Release gate

A `main` só recebe esta branch depois de:

1. P0 concluído e evidenciado.
2. Todos os testes de isolamento e quotas passarem em staging.
3. Stripe + Brevo testados no ambiente correcto.
4. Booking concorrente testado.
5. E2E do golden path passar.
6. CI verde na Pull Request.

## Comandos

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm qa:smoke
pnpm qa:plans
pnpm qa:security
pnpm qa:deps
pnpm qa:env
```
