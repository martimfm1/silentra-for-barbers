# Auditoria de concorrência e multi-tenancy da API

**Âmbito:** revisão estática do código em `main` durante outubro de 2026, com foco em pedidos simultâneos, isolamento por barbearia e proteções que funcionam em múltiplas instâncias Vercel.

**Importante:** esta auditoria de código não equivale a um teste de carga nem a uma prova de isolamento em produção. Não foram executados testes concorrentes contra a base de dados de produção.

## Correção incluída nesta branch

### Rate limiting com IP falsificável — corrigido

Os endpoints de marcações públicas e do portal de clientes escolhiam o primeiro valor de `X-Forwarded-For`. Esse valor pode ser fornecido pelo cliente em configurações de proxy que não o removam, permitindo tentar contornar limites de pedidos ao mudar o cabeçalho.

Os três endpoints passaram a usar `getClientIp` de `lib/security/public-rate-limit.ts`, que valida endereços IP, dá prioridade a `x-real-ip` validado e usa o último endereço válido da cadeia encaminhada. O rate limit de produção continua centralizado no RPC da base de dados e falha de forma fechada se o serviço não estiver disponível.

O teste estático de segurança também passa a rejeitar o padrão conhecido de seleção do primeiro valor de `X-Forwarded-For`.

## Controlos já encontrados no código

- **Marcações:** a rota pública valida o payload e consulta serviço/profissional no contexto da barbearia; a criação chama `create_booking_atomic`. A migration encontrada usa `pg_advisory_xact_lock` e verifica sobreposições antes de inserir.
- **Encomendas do marketplace:** a criação chama uma função SQL transacional; a função bloqueia a linha do produto com `FOR UPDATE`, verifica stock e grava encomenda, linhas, stock e movimentos dentro da mesma transação.
- **Rate limiting partilhado:** `consumePublicRateLimit` usa um RPC Supabase em produção, em vez de depender de memória local por instância.
- **Autorização multi-tenant:** existe um guard central, `requireTenantAuthorization`, e várias rotas validam `barbershop_id` explicitamente.
- **Billing:** os serviços de billing incluem verificações de propriedade e upserts idempotentes para o estado da subscrição; isto não substitui testes de eventos Stripe repetidos e fora de ordem.

## Riscos e trabalho que continua necessário

### P1 — Provar isolamento de tenant por testes negativos

A presença de guards e filtros em código não prova que todas as rotas e funções SQL estejam isoladas. É necessário executar uma matriz automatizada com duas barbearias A/B, tentando ler, atualizar e eliminar recursos da B com a sessão/IDs da A, incluindo marketplace, clientes, marcações, CRM, loyalty, inventário, comissões, relatórios, storage e endpoints administrativos. Verificar também policies RLS e permissões de todas as funções `SECURITY DEFINER` na base de dados efetivamente usada em produção.

### P1 — Portal de clientes: emissão concorrente de códigos

`customer-portal/request-code` faz uma sequência de leitura da janela recente, limpeza de códigos antigos e inserção do novo código em operações separadas. Dois pedidos simultâneos para o mesmo email podem ultrapassar o controlo de janela e emitir códigos concorrentes. O rate limit por IP/email reduz abuso, mas não torna essa sequência atómica. Recomenda-se mover o controlo e a emissão para uma função SQL transacional com lock por email normalizado e um limite único verificável.

### P1 — Testes de concorrência contra PostgreSQL

A função de marcações serializa a criação por barbearia, o que protege a integridade mas pode reduzir throughput de uma barbearia muito ativa. É necessário testar horários iguais/sobrepostos, serviços de durações diferentes, profissional específico versus profissional nulo, e marcações em barbearias diferentes. Esperado: apenas um pedido incompatível é aceite; barbearias diferentes não ficam serializadas entre si.

Para o marketplace, testar duas encomendas concorrentes para o último artigo e itens repetidos no mesmo payload. Esperado: stock nunca negativo, uma encomenda rejeitada quando não há stock e nenhuma encomenda parcialmente gravada.

### P1 — Automação de conclusão de marcações

O worker muda o estado antes de despachar automações. Se o envio falhar depois da atualização, a próxima execução já não seleciona a marcação concluída; a automação pode ficar por executar. Para entrega fiável, usar outbox/eventos persistentes com chave idempotente e retries, em vez de depender apenas da transição de estado.

### P2 — Observabilidade e capacidade

Antes de aumentar o tráfego, recolher latência p50/p95/p99, taxa de erros por endpoint, pool/conexões da base de dados, timeouts, consumo de rate limit, falhas de webhooks e backlog de automações. Confirmar limites de conexões Supabase, timeouts das funções Vercel e índices das queries frequentes. Não aumentar limites só para ocultar saturação.

## Gate de produção recomendado

- [ ] Executar `pnpm qa` e os testes de integração contra uma base de staging.
- [ ] Testes E2E A/B de isolamento de tenant em todas as famílias de rotas.
- [ ] Testes concorrentes com 20, 50 e 100 clientes simulados; incluir idempotência e retries.
- [ ] Confirmar migrations, RLS, grants e funções SQL na base de dados de produção/staging.
- [ ] Verificar webhooks e tarefas agendadas duplicadas/repetidas.
- [ ] Fazer rollout controlado e acompanhar erros/latência antes de declarar a API pronta para maior carga.

**Conclusão:** há fundamentos úteis para concorrência (RPC transacional de marcações, bloqueio de stock e rate limiting persistente), mas não é responsável afirmar que toda a aplicação suporta qualquer número de utilizadores em simultâneo sem testes de carga e isolamento. A correção nesta branch fecha uma falha concreta no rate limiting e melhora a deteção de regressões.
