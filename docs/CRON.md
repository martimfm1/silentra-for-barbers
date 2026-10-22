# Cron e workers agendados

## Princípio

Tarefas frequentes que alteram dados da aplicação devem correr no Supabase/Postgres sempre que a operação puder ser executada por uma função SQL. Isto evita dependência das limitações de frequência do Vercel Cron e reduz latência de rede.

## Campanhas de marketing e aniversários

O endpoint `/api/cron/marketing` está agendado diariamente pelo Vercel Cron às 00:10 UTC. Requer `CRON_SECRET` configurado no ambiente de produção e processa:
- campanhas de aniversário e respetivos vouchers;
- campanhas de marketing agendadas;
- destinatários em fila e novas tentativas de entrega.

A execução regista contagens de campanhas, destinatários enviados/falhados e duração nos logs `[MARKETING_CRON]`. O endpoint deve permanecer protegido por `CRON_SECRET`.

## Conclusão automática de marcações

A função canónica é:

```sql
public.process_automatic_booking_completion()
```

Ela marca como `completed` as marcações `scheduled` cuja hora final já passou e cuja barbearia tem `auto_complete_bookings = true`.

O scheduler é Supabase Cron (`pg_cron`) e corre a cada 10 minutos através do job:

```text
silentra-booking-completion
```

A configuração está em:

```text
supabase/migrations/20260827180000_schedule_booking_completion_with_pg_cron.sql
```

## Vercel

`vercel.json` mantém apenas cron jobs diários compatíveis com Vercel Hobby. Não agendar `/api/cron/booking-lifecycle` de hora a hora em Vercel Hobby: o deploy de produção é rejeitado por essa frequência. O estado da conclusão automática é tratado pelo job `silentra-booking-completion` do Supabase a cada 10 minutos. A emissão das automações `booking_completed` pela rota HTTP ainda requer uma estratégia de execução compatível com o plano antes de ser considerada ativa em produção.

O endpoint `/api/cron/booking-completion` continua disponível para execução controlada/manual, mas não é o scheduler principal.

## Operação

Depois de aplicar as migrations:

```bash
supabase db push
```

No Supabase, confirmar em **Integrations → Cron** que `silentra-booking-completion` está ativo e consultar o histórico de execuções em caso de falha.

O Supabase Cron suporta jobs SQL e funções de base de dados e permite frequências inferiores a um dia, tornando-o adequado para este worker.
