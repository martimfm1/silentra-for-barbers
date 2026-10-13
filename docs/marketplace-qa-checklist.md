# Marketplace QA checklist

## Checkout

- [ ] Testar carrinho com produtos de uma única barbearia.
- [ ] Confirmar que o servidor calcula os preços e totais.
- [ ] Testar stock insuficiente e pedidos concorrentes.
- [ ] Confirmar que erros temporários mantêm os dados do formulário.

## Segurança

- [ ] Confirmar isolamento entre duas barbearias de teste.
- [ ] Confirmar que o vendedor não acede a encomendas de outra barbearia alterando o ID.
- [ ] Testar validação de IDs, quantidades e payloads inválidos.
- [ ] Confirmar rate limit e respostas HTTP 429.
- [ ] Confirmar que erros internos não são devolvidos diretamente ao cliente.

## Ciclo de vida e emails

- [ ] Testar todas as transições de estado permitidas e proibidas.
- [ ] Confirmar que uma falha de email não reverte uma encomenda já registada.
- [ ] Confirmar que os campos de utilizador são escapados em emails HTML.
- [ ] Confirmar que os logs não incluem dados pessoais desnecessários.

## Interface

- [ ] Testar checkout em telemóvel e desktop.
- [ ] Confirmar rótulos acessíveis, foco visível e mensagens de erro claras.
- [ ] Confirmar estados vazios, carregamento e recuperação após erro.

## Antes de publicar

- [ ] Executar os comandos typecheck, lint e build definidos no package.json.
- [ ] Executar os testes de API, segurança e produto disponíveis.
- [ ] Testar o percurso completo: catálogo, carrinho, encomenda, atualização de estado e email.
- [ ] Registar resultados reais; não considerar a checklist aprovada apenas por revisão de código.
