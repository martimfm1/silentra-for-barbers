# Silentra Marketplace — Produto e experiência

## Objetivo

Transformar o marketplace numa experiência de compra simples para clientes e num canal de vendas realmente operacional para cada barbearia, mantendo a identidade visual da Silentra e a arquitetura multi-tenant existente.

O marketplace público deve continuar acessível sem conta. A Silentra fornece o software; cada barbearia é responsável pelo stock, preparação, levantamento, envio, pagamentos acordados e política de devoluções. A Silentra não assume a logística física.

## Experiência do consumidor

### Descoberta

- Pesquisa por nome e descrição, disponível também em ecrãs móveis.
- Filtros por categoria e barbearia; ordenação por destaque, novidade e preço.
- Só apresentar produtos ativos, publicados, com stock e pertencentes a barbearias com catálogo público e vendas online ativas.
- Cartões de produto com fotografia, nome, barbearia, preço, preço anterior quando válido, disponibilidade e acesso claro ao detalhe.
- Estados vazios úteis, erro recuperável e carregamento com skeletons.
- Nunca apresentar dados internos da barbearia nem confiar em filtros de tenant enviados pelo browser.

### Compra sem fricção

- Carrinho de uma única barbearia por encomenda, com indicação clara quando trocar de vendedor substitui o carrinho atual.
- Quantidades limitadas pelo stock visível; preço, stock e total recalculados no servidor.
- Checkout sem obrigar à criação de conta: nome, email e telefone.
- Levantamento ou entrega apenas quando suportados pela configuração do vendedor.
- Pedir morada apenas para entrega; validar código postal e campos obrigatórios.
- Resumo final com produtos, quantidades, vendedor, método de entrega e total.
- Prevenir duplo envio no checkout e comunicar erros sem perder os dados já preenchidos.
- Ecrã de confirmação com referência da encomenda e estado do envio do comprovativo por email claramente separado do estado da encomenda.
- O comprovativo de encomenda não deve ser apresentado como fatura.

### Pós-compra

- Email de confirmação com referência, artigos, total, vendedor, instruções de levantamento/entrega e ligação privada para acompanhar a encomenda.
- Página de acompanhamento sem conta com estado atual, progresso, histórico cronológico, resumo dos produtos, total e dados de entrega.
- Cada ligação usa uma capacidade aleatória de 256 bits; só o hash SHA-256 fica persistido. As ligações expiram ao fim de um ano e podem ser revogadas no servidor. Não permitir consultar encomendas apenas com um ID sequencial ou email.
- Emails de alteração de estado geram ligações independentes; uma nova notificação não invalida a ligação do comprovativo.
- A página remove o token da barra de endereço/histórico após a leitura, usa respostas não cacheáveis, não permite indexação e não envia Referer.
- Mensagens de estado coerentes entre email, página pública e painel do vendedor; a página atualiza manualmente e faz atualização automática moderada enquanto está visível.
- Cancelamento e devoluções de acordo com as regras publicadas pelo vendedor e com trilho de auditoria.
- Avaliações verificadas apenas após uma compra concluída, com prevenção de duplicados e moderação.

## Experiência do vendedor

### Catálogo e inventário

- Criar, editar, arquivar e publicar produtos.
- Nome, descrição, categoria, imagens, SKU opcional, preço, preço promocional, stock e limiar de stock baixo.
- Alternar entre venda apenas presencial e venda presencial + online.
- Pré-visualizar o produto como o cliente o verá.
- Mostrar estado explícito: rascunho, publicado, sem stock ou arquivado.
- Avisos para imagens ausentes, preço inválido, stock baixo e produtos não publicáveis.
- Operações sempre limitadas à barbearia autenticada no servidor.

### Operação de encomendas

- Lista pesquisável e filtrável por estado e método de entrega.
- Estados de negócio explícitos: recebida, confirmada, em preparação, pronta, enviada, entregue, concluída e cancelada.
- Transições validadas no servidor; não aceitar saltos arbitrários de estado.
- Linha temporal de eventos com autor, data, estado anterior/novo e mensagem ao cliente.
- Dados de contacto e morada acessíveis apenas a membros autorizados da barbearia.
- Ações rápidas para confirmar, preparar, marcar como pronta, enviada/entregue e cancelar quando permitido.
- Email ao cliente para alterações importantes, com falhas de envio visíveis e possibilidade de reenvio.
- Não inventar integração de tracking ou transportadora; a barbearia gere o envio por sua conta.

### Visão de negócio

- Métricas separadas: encomendas abertas, concluídas, valor de encomendas não canceladas e unidades vendidas.
- Período selecionável para relatórios e comparação justa com o período anterior.
- Receita bruta não deve ser confundida com lucro, pagamentos recebidos ou faturação fiscal.
- Exportações futuras devem minimizar dados pessoais e registar quem as gerou.
- Alertas de stock baixo e produtos publicados sem stock.

## Regras técnicas e de segurança

1. **Multi-tenant fail-closed:** o vendedor/tenant é sempre obtido da sessão e validado no servidor; nunca confiar em `barbershopId` enviado pelo cliente para autorizar operações.
2. **Catálogo público separado:** o catálogo pode ser público, mas só devolve os campos explicitamente públicos e filtra visibilidade na consulta à base de dados.
3. **Stock atómico:** criar encomendas e decrementar stock através de transação/RPC atómica; se um artigo não tiver stock, a encomenda inteira falha sem alterações parciais.
4. **Preço autoritativo:** o servidor calcula preço, descontos e total a partir da base de dados. Ignorar preços e totais enviados pelo browser.
5. **Validação:** limitar tamanhos de strings, número de artigos, quantidades, UUIDs, métodos de entrega e transições de estado.
6. **Abuso:** rate limit no catálogo e criação de encomendas, respostas genéricas onde necessário e logs sem emails, telefones, moradas, tokens ou payloads sensíveis.
7. **Privacidade:** recolher apenas dados necessários, definir retenção e garantir acesso restrito a contactos, moradas e histórico de encomendas.
8. **Email fiável:** escapar HTML, não registar tokens nem URLs de acompanhamento, usar apenas a origem HTTPS canónica configurada, separar o estado da encomenda do resultado do envio de email e manter capacidades de acompanhamento diferentes para cada notificação.
9. **Observabilidade:** logs estruturados com identificador de operação, tenant interno, resultado e código de erro; nunca registar dados pessoais desnecessários.
10. **Testes:** cobrir isolamento entre barbearias, preço adulterado, stock concorrente, checkout repetido, estados inválidos, vendedor desativado, produto oculto, rate limit e falha de email.

## Ordem recomendada de implementação

1. **Base de experiência:** mobile-first, pesquisa sempre acessível, acessibilidade, loading/error/empty states e carrinho claro.
2. **Compra segura:** validação de checkout, stock/preços autoritativos, idempotência e confirmação pós-compra.
3. **Operação do vendedor:** catálogo, estados de encomenda, timeline e notificações fiáveis.
4. **Pós-compra:** acompanhamento seguro por token, histórico de estado, notificações com ligações independentes e política de cancelamento/devolução.
5. **Crescimento:** avaliações verificadas, promoções, favoritos e relatórios por período.

## Critérios de aceitação

- Um consumidor consegue descobrir e encomendar produtos num telemóvel sem criar conta.
- Um consumidor não consegue comprar produtos ocultos, inativos, sem stock ou de um vendedor sem vendas online ativas.
- Alterar preço, stock, tenant ou total no browser não altera o resultado autoritativo do servidor.
- Uma encomenda não pode reduzir stock abaixo de zero, mesmo com pedidos concorrentes.
- Uma barbearia nunca consegue ler ou alterar produtos, encomendas ou dados pessoais de outra.
- O vendedor consegue compreender rapidamente o que exige ação e atualizar a encomenda com um histórico auditável.
- Uma falha de email não apaga a encomenda nem é apresentada como sucesso de envio.
- Uma ligação de acompanhamento válida apenas revela a encomenda associada à capacidade e não pode ser enumerada por ID; tokens expirados/revogados falham de forma genérica.
- As mudanças de estado aparecem no histórico do cliente e as novas notificações não invalidam ligações enviadas anteriormente.
- Os fluxos principais funcionam por teclado, têm labels acessíveis e mantêm estados de erro compreensíveis.

## Página de produto e destaque Enterprise

- Cada produto público tem uma página própria em `/marketplace/[productId]`, com imagem, descrição, categoria, vendedor, preço, preço anterior quando aplicável, stock e seleção de quantidade.
- A passagem entre a página de produto e o carrinho deve preservar os artigos existentes e validar novamente a disponibilidade do produto.
- O formulário do vendedor deve recolher o nome, preço, stock, descrição, categoria, imagem opcional, SKU opcional, preço anterior e limiar de alerta de stock; o preço e o stock continuam a ser autoritativos no servidor.
- O destaque só pode ser ativado no servidor para lojas com plano efetivo `enterprise`, produtos publicados com stock e dentro das primeiras 72 horas desde a primeira publicação.
- A data original de publicação deve manter-se nas edições. A expiração não pode ser prolongada por editar o produto ou retirar e voltar a ativar o destaque.
- Antes do deploy, aplicar as migrations `20261013160000_marketplace_product_publication_boost.sql` e `20261013180000_marketplace_order_tracking_capabilities.sql` e executar os testes de tipo, lint, auditoria de API, contratos de produto, formatação, build e smoke tests.
