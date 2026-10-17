# UI/UX e acessibilidade — auditoria transversal

## Âmbito

Esta auditoria abrange as rotas de navegação partilhadas, a barra principal, o menu do dashboard, os componentes globais e os contratos automatizados. Não é uma declaração de conformidade WCAG certificada: verificações visuais e com leitores de ecrã continuam a exigir testes num browser real.

## Problemas identificados e correções

| Área | Problema | Correção aplicada |
| --- | --- | --- |
| Navegação da navbar | Os links ingleses para Clientes e Equipa apontavam para `/dashboard/clients` e `/dashboard/team`, que não correspondem às rotas existentes. | Redirecionar para `/dashboard/clientes` e `/dashboard/equipa`. |
| Densidade do menu | A sidebar apresentava muitas áreas ao mesmo nível visual. | Deixar as tarefas frequentes visíveis; agrupar Comunicação e Ferramentas/Análise em secções recolhíveis. |
| Acesso à página Comunicação | O botão funcionava apenas como expansor e a rota-pai ficava fora da lista. | Mostrar também a entrada Comunicação dentro do grupo expansível. |
| Navegação móvel | O acesso rápido dava prioridade ao QR Code em vez de Serviços. | Priorizar Início, Agenda, Clientes e Serviços; as áreas menos frequentes ficam em “Mais”. |
| Barra fixa do dashboard | Um relógio atualizado a cada segundo ocupava espaço sem ajudar a localizar a página; o conteúdo podia começar atrás da barra. | Substituir o relógio por um rótulo/breadcrumb contextual e reservar espaço para a navegação fixa. |
| Consistência linguística | Vários rótulos da sidebar ficavam em português quando a interface estava em inglês. | Localizar rótulos, secções e controlos da navegação móvel. |
| Teclado nos menus móveis | A navegação móvel global e a drawer do dashboard não mantinham o foco no diálogo nem o devolviam ao botão quando fechavam. | Implementar ciclo de foco por Tab/Shift+Tab, Escape, foco inicial e devolução do foco ao controlo de abertura nos dois menus. |
| Movimento | Algumas animações CSS decorativas ignoravam a preferência do sistema. | Aplicar `prefers-reduced-motion` globalmente e desativar a animação beam. |
| Ecrãs pequenos | Cabeçalhos e conteúdos densos podiam causar quebra de layout/overflow. | Adaptar cabeçalhos, ações, tabelas e conteúdo do dashboard a larguras pequenas. |
| Feedback de email de suporte | A lógica agrupava mensagens não lidas e podia suprimir um email por mensagem. | Criar um registo outbox por cada mensagem e não cancelar a notificação se a conversa for aberta antes do envio. |

## Regras de UX aplicadas

- Uma hierarquia clara: tarefas frequentes primeiro, áreas secundárias agrupadas e opções de conta separadas.
- Menos decisões simultâneas; as ferramentas secundárias aparecem quando o utilizador abre o grupo correspondente.
- Os grupos revelam o seu estado através de `aria-expanded` e apontam para o conteúdo através de `aria-controls`.
- Navegação atual identificada com `aria-current="page"`; botões e links partilham estados de foco visíveis.
- Áreas interativas com alvo mínimo global de 44 px, conforme os estilos partilhados existentes.
- Movimento reduzido, conteúdo que se adapta e texto que pode quebrar sem criar overflow horizontal.
- Email transacional independente por mensagem, com ligação direta para o local onde a pessoa deve responder.

## Validação automatizada

`pnpm qa:ux` valida os destinos de navegação conhecidos, a existência das rotas-alvo, os disclosures da sidebar, o foco de teclado, o skip link, a preferência de movimento reduzido e a regra de notificação por mensagem. A verificação é executada na CI e incluída em `pnpm qa`.

## Testes manuais necessários antes de declarar conformidade total

1. Testar larguras de 320, 375, 768, 1024 e 1440 px; confirmar que não existe scroll horizontal inesperado e que ações principais estão visíveis.
2. Percorrer navbar, menus, diálogos, formulários, tabelas, filtros e chat usando apenas Tab, Shift+Tab, Enter, Espaço e Escape. Confirmar ordem lógica, breadcrumb contextual e retorno do foco.
3. Testar zoom a 200% e 400%, alto contraste e preferências de movimento reduzido.
4. Usar axe DevTools ou equivalente e um leitor de ecrã (NVDA/Firefox ou VoiceOver/Safari) para verificar nomes acessíveis, títulos, erros de formulário, landmarks, anúncios de atualização e tabelas.
5. Confirmar contraste de texto, placeholders, estados desativados, erros e indicadores de foco em todos os temas.
6. Enviar várias mensagens seguidas em ambos os sentidos, abrir imediatamente o chat após envio e confirmar que cada mensagem origina um email. Testar falhas do Brevo e retentativas do outbox.

## Limites conhecidos

- A auditoria estática não mede contraste calculado por todos os temas nem comprova o comportamento de todos os componentes em tecnologias de apoio.
- O envio real de emails depende de `BREVO_API_KEY`, `BREVO_FROM_EMAIL` ou `SENDER_EMAIL`, e da identidade de suporte configurada. Os testes de contrato não substituem um envio controlado em produção.
