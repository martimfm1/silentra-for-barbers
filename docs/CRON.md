# Cron e workers agendados

## Princípio

Tarefas frequentes que alteram dados da aplicação devem correr no Supabase/Postgres sempre que a operação puder ser executada por uma função SQL. Isto evita dependência das limitações de frequência do Vercel Cron e reduz latência de rede.

## Campanhas de marketing e aniversários

O endpoint `/api/cron/marketing` está agendado diariamente pelo Vercel Cron às 00:10 UTC (a hora local em Portugal muda com o horário de verão). Requer `CRON_SECRET` configurado no ambiente de produção e processa:
- campanhas de aniversário e respetivos vouchers;
- campanhas de marketing agendadas;
- destinatários em fila e novas tentativas de entrega.

A execução regista contagens de campanhas, destinatários enviados/falhados e duração nos logs `[MARKETING_CRON]`. O endpoint deve permanecer protegido por `CRON_SECRET`.

A configuração da mensagem é gerida em `/api/messages/birthdays`; este é um endpoint de configuração, não um cron. Não existe uma rota de execução `/api/cron/birthdays`: o envio é feito pelo worker de marketing. A migration `20261022161843_reconcile_legacy_birthday_campaigns.sql` recupera configurações antigas ativas que ainda não tenham uma campanha no sistema de Marketing, sem substituir campanhas existentes.

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

## Fila de automações de marcações concluídas

O trigger `appointments_enqueue_booking_completed_automation` cria um evento idempotente em `booking_automation_outbox` sempre que uma marcação muda para `completed`. O worker `/api/cron/booking-automation-outbox` reclama lotes com `FOR UPDATE SKIP LOCKED`, tenta novamente com atraso exponencial e recupera leases abandonadas. O endpoint aceita `BOOKING_OUTBOX_CRON_SECRET` (preferencial) ou `CRON_SECRET`.

O agendamento de alta frequência deve ser feito pelo Supabase Cron através de `pg_net`, com URL e segredo HMAC guardados no Vault; não adicionar um cron horário ao Vercel Hobby. O pedido HTTP tem timeout de 15 segundos para tolerar arranques a frio do Vercel.

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
