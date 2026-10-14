# SEO e conversão — Silentra for Barbers

## Implementado na aplicação

- Metadata de base em português de Portugal, títulos e descrições comerciais e pré-visualização Open Graph/Twitter.
- Canonical definido por página, sem herdar a homepage como canonical para rotas sem metadados próprios.
- Landing page de intenção comercial em `/software-gestao-barbearia`, com conteúdo útil, ligações para registo e planos e FAQs visíveis.
- Dados estruturados Schema.org para a aplicação, a página, breadcrumbs e perguntas frequentes. Não são declaradas avaliações, números de clientes ou prémios inventados.
- Sitemap com a landing page comercial e landing pages Enterprise activas, quando a base de dados está disponível.
- Robots.txt com sitemap e sem bloquear páginas em que os motores de pesquisa precisam de ler as diretivas `noindex`.
- Eventos de clique CTA enviados para o dataLayer do Google Tag Manager como `silentra_cta_click`, incluindo identificador, localização e destino sem dados pessoais.
- Teste de contratos SEO integrado no QA/CI.

## Ativação obrigatória após o merge/deploy

1. **Google Search Console:** adiciona a propriedade de domínio `silentra.me` por DNS (recomendado) ou a propriedade URL-prefix `https://barbers.silentra.me/`. No caso do método HTML tag, define `GOOGLE_SITE_VERIFICATION` nas variáveis de ambiente de produção com o token de verificação fornecido pelo Google. Não coloques o token no repositório.
2. **Sitemap:** submete `https://barbers.silentra.me/sitemap.xml` no Search Console e inspeciona a homepage, `/software-gestao-barbearia`, `/plans` e uma landing page Enterprise activa. Solicita indexação quando a versão publicada já estiver acessível.
3. **Dados reais:** verifica os relatórios de páginas indexadas, consultas, CTR e posição. Corrige erros de cobertura, canonicals ou dados estruturados que o Search Console reportar.
4. **GTM:** cria um trigger do tipo *Custom Event* para `silentra_cta_click` e uma tag GA4 Event (por exemplo, `cta_click`) que envie `cta_id`, `cta_location` e `cta_destination`. Testa em Preview/DebugView antes de publicar o container.
5. **Conversões reais:** mede separadamente registo concluído, início de checkout e primeira subscrição paga. Um clique no botão não é uma conversão final; os eventos de autenticação/pagamento devem vir dos passos confirmados no backend e ser deduplicados.
6. **Links do Instagram:** usa um URL com UTM na bio/Link-in-bio para separar tráfego do Reel, por exemplo:
   `https://barbers.silentra.me/software-gestao-barbearia?utm_source=instagram&utm_medium=organic_social&utm_campaign=reels_launch`
   Mantém o mesmo link durante o teste e compara sessões, registos concluídos e subscrições, não apenas visualizações.

## Prioridades contínuas

- Publica conteúdos originais que respondam a dúvidas reais de barbeiros: gestão de marcações, redução de faltas, confirmação de reservas, gestão de equipa e comparação de processos. Cada conteúdo deve ter exemplos úteis próprios e ligar naturalmente à plataforma.
- Pede autorização para publicar testemunhos reais e identifica claramente quem os deu. Nunca inventes reviews, estrelas ou estatísticas.
- Pede ligações a partir de parceiros, associações locais e barbearias utilizadoras quando existir uma relação real.
- Mantém títulos, descrições e texto visível específicos. Evita gerar dezenas de páginas quase iguais por cidade/keyword.
- Revê Core Web Vitals e desempenho mobile com dados reais de PageSpeed/Search Console; não substituas medições por valores presumidos.

## Limites

O código prepara a implementação técnica, mas não pode garantir posicionamento, indexação ou recomendações por um motor de pesquisa. A indexação depende do acesso público à versão em produção, da qualidade do conteúdo e dos sinais que os motores de pesquisa recolherem ao longo do tempo.
