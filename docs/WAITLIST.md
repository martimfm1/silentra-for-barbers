# Lista de espera

A lista de espera permite a um cliente pedir para ser contactado quando não encontra um horário adequado e permite à barbearia recuperar vagas futuras libertadas por cancelamentos.

## Fluxo do cliente

1. Na página de marcação, o cliente escolhe o serviço, o barbeiro (quando aplicável) e a data.
2. Se não existirem horários disponíveis, pode deixar nome, email e telefone e aceitar um aviso específico de contacto operacional.
3. O pedido fica como `waiting`. Não cria uma marcação, não bloqueia um horário e não inclui consentimento para marketing.
4. Quando surge uma vaga compatível, o sistema envia um email com o serviço, dia, hora e barbeiro (quando definido).
5. A proposta expira após 20 minutos. O email deixa claro que a vaga não fica reservada: só é confirmada depois de o cliente concluir o processo normal de reserva.
6. O link abre a página de marcação com os dados da vaga pré-selecionados. A API de marcações volta a validar disponibilidade e conflitos.
7. Se o cliente concluir a marcação com o mesmo email e horário, o pedido passa a `booked` e fica ligado à nova marcação. Se outra pessoa ocupar a vaga, o convite é invalidado.

## Fluxo da barbearia

A página **Dashboard → Lista de espera** mostra pedidos ativos e histórico. Permite pesquisar clientes, consultar serviço, profissional, data e janela horária, abrir email/telefone e atualizar manualmente o estado.

Quando uma marcação futura passa para `cancelled`, um trigger regista a vaga na fila. A fila só envia uma proposta de cada vez para cada vaga e respeita a ordem de entrada entre pedidos compatíveis da mesma barbearia, serviço, data, barbeiro e intervalo horário.

## Processamento automático

- A fila é reclamada pelo worker `/api/cron/booking-waitlist-offers` em lotes, com `FOR UPDATE SKIP LOCKED`.
- O Supabase Cron agenda a execução a cada 2 minutos.
- A chamada é autenticada por HMAC, usando os segredos já partilhados com os workers de booking: `silentra_booking_outbox_cron_secret` e `silentra_booking_outbox_url`.
- Os convites expiram ao fim de 20 minutos.
- Falhas antes da aceitação do email pelo fornecedor libertam o pedido para nova tentativa com atraso progressivo; após o fornecedor aceitar o email, o worker não reenvia automaticamente em caso de falha ao atualizar o estado, para evitar duplicados.
- A vaga deixa de ser oferecida se outra marcação ocupar o intervalo ou se a agenda for bloqueada entretanto.
- O worker só processa datas dentro da janela atual de 14 dias apresentada no booking público.

## Dados e privacidade

A tabela `booking_waitlist` contém o contacto, serviço, barbeiro opcional, data/janela pretendida e registo temporal do consentimento. A tabela `booking_waitlist_vacancies` contém a vaga cancelada e o estado de envio.

As duas tabelas têm RLS ativado e não concedem acesso direto a `anon` ou `authenticated`. O acesso é feito apenas por APIs/cron server-side com service role e queries limitadas ao identificador da barbearia.

O consentimento mostrado no booking é apenas para contacto sobre a vaga pedida. Não deve ser reutilizado para campanhas de marketing.

## Aplicação da migration e configuração

A migration `20261103235000_automatic_booking_waitlist_offers.sql` cria as tabelas/funções/triggers e agenda o cron. Antes de aplicar em produção, confirmar que os dois segredos Vault indicados estão configurados, que o endpoint base aponta para a instalação correta e que o worker está publicado.

O estado da lista de espera fica visível na dashboard; a página pública de estado da plataforma não expõe informação pessoal nem estados da fila.
