# Operações de privacidade e RGPD

> Documento operacional interno. Não é aconselhamento jurídico, uma DPA assinável nem prova de conformidade. Validar com assessoria jurídica e confirmar a configuração real dos fornecedores antes do lançamento comercial.

## 1. Papéis e dados

A política pública em `/privacy` descreve o modelo pretendido: a Silentra atua como responsável pelo tratamento de dados de conta, segurança, faturação e suporte; a barbearia é normalmente responsável pelos dados dos seus clientes finais e a Silentra atua como subcontratante quando os processa em seu nome. Confirmar cada fluxo e os papéis reais antes de assinar contratos.

Categorias conhecidas a rever:

- Conta e autenticação: nome, email, telefone, função e identificadores de sessão.
- Operação da barbearia: perfil, horários, serviços, equipa e configurações.
- Marcações/CRM: contacto do cliente, serviço, profissional, data/hora, estado e notas.
- Faturação: plano, identificadores Stripe, histórico de pagamentos e documentos.
- Marketplace/POS: produtos, encomendas, estados, entrega e registos de acompanhamento.
- Segurança/observabilidade: request IDs, códigos de erro, duração, região e logs operacionais.
- Comunicações: endereços de email, preferências e metadados de entrega.

Minimizar dados pessoais nos logs. Não registar tokens de tracking, credenciais, dados completos de pagamento ou payloads de marcação.

## 2. Pedidos de titulares

Canal publicado: `contact@silentra.me`. Até existir um portal automatizado, os pedidos devem ser tratados por um processo controlado:

1. Registar data de receção, tipo de pedido e responsável, sem copiar dados excessivos para tickets.
2. Verificar a identidade proporcionalmente ao risco; nunca pedir palavras-passe ou códigos de autenticação.
3. Identificar se a Silentra é responsável ou subcontratante para os dados em causa.
4. Para dados controlados pela barbearia, encaminhar/coordenar com a barbearia e documentar a autorização antes de agir.
5. Recolher dados das fontes relevantes e responder dentro do prazo legal aplicável, com validação jurídica quando necessário.
6. Para apagamento, avaliar obrigações legais de conservação, disputas, prevenção de fraude, backups e propagação a subprocessadores antes de executar.
7. Registar conclusão e exceções sem armazenar uma cópia desnecessária dos dados exportados.

**Bloqueador:** este processo manual não substitui funcionalidades técnicas de exportação e eliminação verificáveis. Não anunciar exportação ou apagamento automático até existirem e terem sido testados.

## 3. Retenção e eliminação

Definir e aprovar uma tabela de retenção por categoria antes de lançamento:

- Contas e perfis.
- Marcações e CRM.
- Faturação e documentos financeiros.
- Logs de segurança/observabilidade.
- Tokens de acesso e tracking.
- Backups e exports temporários.
- Dados de marketing e preferências.

Para cada categoria, especificar finalidade, base legal, período, evento de início, responsável, processo de eliminação/anonimização e tratamento em backups. Os prazos fiscais e de defesa de direitos devem ser confirmados por assessoria jurídica; não assumir um único prazo para todos os dados.

## 4. Subprocessadores

Manter uma lista verificável que inclua, no mínimo, alojamento/runtime (Vercel), base de dados/auth (Supabase), pesquisa de moradas (Mapbox), mapas/base tiles (CARTO), pagamentos (Stripe), email transacional (Brevo), analytics/pixels efetivamente ativos e storage opcional (AWS/S3, se ativado).

Para cada fornecedor, registar:

- Serviço e finalidade.
- Categorias de dados transmitidos.
- Localização/regiões e transferências internacionais.
- Termos de tratamento/DPA e mecanismo de transferência aplicável.
- Retenção, subprocessadores e contacto de privacidade.
- Data da última revisão.

Não presumir que um fornecedor ou integração está ativo só porque existe código para ele.

## 5. DPA e contrato com barbearias

Antes de ativar clientes comerciais, preparar e rever juridicamente uma DPA que cubra instruções documentadas, confidencialidade, medidas técnicas/organizativas, subprocessadores, assistência a direitos dos titulares, incidentes, auditorias, devolução/eliminação de dados e transferências internacionais.

## 6. Cookies e analytics

Inventariar cookies, local storage, pixels e scripts externos por rota. Distinguir tecnologias estritamente necessárias das opcionais. Confirmar que consentimento/preferências bloqueiam tags não essenciais antes do consentimento, quando exigido, e que a retirada de consentimento é respeitada. Testar em browser limpo e em ambas as línguas.

## 7. Incidentes de dados pessoais

1. Conter o incidente e preservar evidência.
2. Identificar categorias de dados, titulares, tenants e período afetado.
3. Envolver imediatamente o responsável pela privacidade e assessoria jurídica.
4. Avaliar obrigações e prazos de notificação à autoridade e aos titulares.
5. Registar decisão, fundamentação, mitigação e prevenção.
6. Rotacionar credenciais afetadas e testar correções.

## 8. Estado de lançamento

Documentação pública criada:
- `/legal`: índice dos documentos.
- `/terms` e `/acceptable-use`: condições gerais e utilização permitida.
- `/privacy` e `/cookies`: informação de privacidade e consentimento.
- `/booking-terms` e `/billing-policy`: regras para reservas e subscrições.
- `/dpa`: modelo de adenda de tratamento de dados, ainda sujeito a revisão jurídica e aceitação pelas partes.
- `/subprocessors`: lista pública de fornecedores conhecidos, a confirmar contra os contratos e a configuração efetivamente ativa.

Limitações que permanecem:
- A identificação pública da entidade exploradora tem de ser configurada com a denominação legal, morada geográfica e NIF em `NEXT_PUBLIC_LEGAL_ENTITY_NAME`, `NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS` e `NEXT_PUBLIC_LEGAL_ENTITY_TAX_ID`. Quando aplicável, configurar também o número de registo em `NEXT_PUBLIC_LEGAL_ENTITY_REGISTRATION` e o telefone em `NEXT_PUBLIC_LEGAL_ENTITY_PHONE`. Não inventar estes dados.
- O DPA publicado é um modelo de trabalho; deve ser revisto, completado com a identificação das partes e aceite antes de servir como acordo contratual.
- A lista de subprocessadores deve ser reconciliada com todos os fornecedores e etiquetas realmente ativos, contratos, localizações e mecanismos de transferência.
- Os pedidos de exportação e eliminação continuam a ser tratados manualmente. Não anunciar uma função automática até estar implementada, testada e documentada.
- Definir e aprovar uma tabela de retenção por categoria, incluindo logs, cópias de segurança e documentos fiscais.
- A configuração do contentor Google Tag Manager deve ser auditada antes de publicar novas etiquetas e depois de qualquer alteração.

Não marcar o RGPD como concluído até haver revisão jurídica das políticas e termos, DPA efetivamente aceite, subprocessadores e transferências verificados, retenção aprovada, fluxos de exportação/eliminação testados, avaliação de consentimento e um exercício documentado de resposta a incidente.
