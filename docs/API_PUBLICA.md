# API pública — Silentra for Barbers

A API pública v1 permite integrar informação pública das barbearias Silentra em websites, diretórios e aplicações. O contrato é de **consulta apenas**: não cria nem altera marcações, clientes, serviços, pagamentos ou configurações.

- **Base URL:** `https://barbers.silentra.me`
- **Formato:** JSON em UTF-8
- **Versão:** v1
- **Autenticação:** não necessária para este recurso público
- **Especificação:** [OpenAPI 3.1](../public/openapi-v1.yaml)
- **Documentação online:** [barbers.silentra.me/documentation](https://barbers.silentra.me/documentation)

## 1. Endpoint

```http
GET /api/v1/public/barbershops/{slug}
```

Exemplo:

```bash
curl --include \
  --header "Accept: application/json" \
  "https://barbers.silentra.me/api/v1/public/barbershops/barbearia-exemplo"
```

Substitui `barbearia-exemplo` pelo slug público da barbearia. Os slugs têm entre 3 e 60 caracteres e seguem o padrão `a-z`, `0-9` e hífen, sem hífen inicial ou final. O slug não distingue maiúsculas de minúsculas. Slugs personalizados são resolvidos pelo mesmo serviço que serve o perfil público.

Não é necessário enviar `Authorization`, API key, cookies ou sessão de utilizador. Não envies segredos no URL.

## 2. Pedidos e cabeçalhos

| Cabeçalho                  | Obrigatório | Utilização                                             |
| -------------------------- | ----------- | ------------------------------------------------------ |
| `Accept: application/json` | Recomendado | Declara que a aplicação espera JSON.                   |
| `If-None-Match`            | Opcional    | Revalida uma resposta guardada usando o ETag anterior. |

A API também aceita `OPTIONS` para preflight CORS. Não existem parâmetros de consulta suportados neste momento.

### Exemplo de resposta

Os valores abaixo são fictícios e servem apenas para ilustrar o contrato:

```json
{
  "apiVersion": "1",
  "data": {
    "barbershop": {
      "id": "public-barbershop-id",
      "slug": "barbearia-exemplo",
      "name": "Barbearia Exemplo",
      "city": "Braga",
      "address": "Rua Exemplo, 10",
      "phone": "+351 200 000 000",
      "avatarUrl": null,
      "coverUrl": null,
      "tags": ["clássica", "fade"],
      "publicProfileEnabled": true,
      "seo": {
        "title": null,
        "description": null,
        "imageUrl": null
      },
      "amenities": {},
      "openingHours": {
        "opens": "09:00:00",
        "closes": "19:00:00",
        "lunchStarts": null,
        "lunchEnds": null,
        "closedDays": ""
      }
    },
    "services": [
      {
        "id": "public-service-id",
        "name": "Corte clássico",
        "price": 15,
        "currency": "EUR",
        "durationMinutes": 30,
        "popular": true
      }
    ],
    "reviews": [
      {
        "id": "public-review-id",
        "name": "Cliente",
        "rating": 5,
        "comment": "Excelente serviço.",
        "createdAt": "2026-10-01T10:00:00.000Z"
      }
    ],
    "rating": 4.8,
    "reviewsCount": 28,
    "bookingUrl": "https://barbers.silentra.me/barbershops/barbearia-exemplo",
    "landingPage": {
      "available": true,
      "url": "https://barbers.silentra.me/site/barbearia-exemplo"
    }
  }
}
```

Os identificadores no exemplo não correspondem a registos reais.

## 3. Modelo de dados

A resposta bem-sucedida tem sempre a estrutura `apiVersion` + `data`.

### `data.barbershop`

| Campo                  | Tipo             | Descrição                                                                               |
| ---------------------- | ---------------- | --------------------------------------------------------------------------------------- |
| `id`                   | string           | Identificador público do perfil.                                                        |
| `slug`                 | string           | Slug canónico do perfil público.                                                        |
| `name`                 | string           | Nome da barbearia.                                                                      |
| `city`                 | string ou `null` | Cidade pública, quando disponível.                                                      |
| `address`              | string ou `null` | Morada pública.                                                                         |
| `phone`                | string ou `null` | Telefone público.                                                                       |
| `avatarUrl`            | string ou `null` | URL pública do avatar/logótipo.                                                         |
| `coverUrl`             | string ou `null` | URL pública da imagem de capa.                                                          |
| `tags`                 | string[]         | Etiquetas públicas do perfil.                                                           |
| `publicProfileEnabled` | boolean          | Indica que o perfil pode ser publicado.                                                 |
| `seo`                  | object           | Título, descrição e imagem Open Graph públicos; os valores podem ser `null`.            |
| `amenities`            | object           | Comodidades públicas normalizadas.                                                      |
| `openingHours`         | object           | Horário de abertura/fecho, pausa de almoço e dias fechados. Os campos podem ser `null`. |

### `data.services[]`

A lista contém até 100 serviços, ordenados primeiro pelos populares e depois pelo nome.

| Campo             | Tipo    | Descrição                                                         |
| ----------------- | ------- | ----------------------------------------------------------------- |
| `id`              | string  | Identificador público do serviço.                                 |
| `name`            | string  | Nome do serviço.                                                  |
| `price`           | number  | Preço numérico em euros.                                          |
| `currency`        | string  | Atualmente `EUR`.                                                 |
| `durationMinutes` | number  | Duração em minutos.                                               |
| `popular`         | boolean | Indica popularidade de acordo com o plano e configuração pública. |

### `data.reviews[]`

A lista contém até 100 avaliações recentes.

| Campo       | Tipo             | Descrição                                   |
| ----------- | ---------------- | ------------------------------------------- |
| `id`        | string           | Identificador público da avaliação.         |
| `name`      | string           | Nome apresentado publicamente na avaliação. |
| `rating`    | number           | Classificação de 1 a 5.                     |
| `comment`   | string ou `null` | Comentário público.                         |
| `createdAt` | string ou `null` | Data/hora ISO 8601, quando disponível.      |

`rating` é a classificação agregada da barbearia quando existe; caso contrário é calculada a partir das avaliações devolvidas. `reviewsCount` usa o total agregado guardado quando está disponível, pelo que pode ser superior ao número de objetos dentro do array limitado a 100 avaliações.

### Ligações

- `bookingUrl`: URL absoluta para o perfil público e fluxo de marcação.
- `landingPage.available`: `true` apenas quando o plano efetivo Enterprise e o entitlement da landing page estão ativos.
- `landingPage.url`: URL absoluta da landing page Enterprise, ou `null` quando não existe acesso ativo.

## 4. Exemplos de integração

### JavaScript no browser ou Node.js

```javascript
const slug = 'barbearia-exemplo';
const url =
  'https://barbers.silentra.me/api/v1/public/barbershops/' +
  encodeURIComponent(slug);

const response = await fetch(url, {
  headers: { Accept: 'application/json' },
});

if (!response.ok) {
  const failure = await response.json().catch(() => ({}));
  throw new Error(failure.error || 'Não foi possível carregar a barbearia.');
}

const { data } = await response.json();
console.log(data.barbershop.name);
console.log(data.services);
console.log(data.bookingUrl);
```

### Next.js — obter os dados no servidor

```typescript
type PublicBarbershopResponse = {
  apiVersion: '1';
  data: {
    barbershop: { name: string; slug: string };
    services: Array<{
      id: string;
      name: string;
      price: number;
      currency: 'EUR';
      durationMinutes: number;
      popular: boolean;
    }>;
    bookingUrl: string;
    landingPage: { available: boolean; url: string | null };
  };
};

export async function getPublicBarbershop(slug: string) {
  const url =
    'https://barbers.silentra.me/api/v1/public/barbershops/' +
    encodeURIComponent(slug);
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error('A API pública respondeu com HTTP ' + response.status);
  }

  return (await response.json()) as PublicBarbershopResponse;
}
```

Usa o exemplo como ponto de partida e amplia o tipo TypeScript conforme os campos de que a integração precisa. Valida sempre o status HTTP antes de ler a resposta.

### Revalidar cache com ETag

Primeiro faz um pedido normal e guarda o valor do cabeçalho `ETag`. No pedido seguinte envia esse valor:

```bash
curl --include \
  --header 'If-None-Match: "etag-recebido-anteriormente"' \
  "https://barbers.silentra.me/api/v1/public/barbershops/barbearia-exemplo"
```

Quando a representação não mudou, a API pode responder `304 Not Modified`, sem corpo. Reutiliza então a representação que a tua aplicação já guardou. O ETag é específico à representação recebida e não deve ser inventado ou construído pelo cliente.

## 5. Cache e desempenho

As respostas de sucesso incluem:

- `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
- `ETag`: hash SHA-256 da representação JSON.
- `X-API-Version: 1`: versão do contrato.
- `X-Request-ID`: identificador para diagnóstico do pedido, quando devolvido pelo middleware.

O CDN pode servir uma representação durante 60 segundos e revalidá-la em segundo plano, usando uma janela stale-while-revalidate de 300 segundos. Se precisares de atualização imediata para uma ação interna, não uses esta API pública como mecanismo de sincronização transacional.

As respostas de erro usam `Cache-Control: no-store`, salvo o `404`, que pode ser guardado por um máximo de 30 segundos. Os clientes devem aceitar que dados públicos em cache não são necessariamente instantâneos.

## 6. Limites de utilização

A API permite inicialmente **120 pedidos por minuto por IP, recurso e slug**.

| Resposta | Significado                                                                |
| -------- | -------------------------------------------------------------------------- |
| `200`    | Dados públicos devolvidos.                                                 |
| `304`    | O ETag corresponde à representação atual; não há corpo.                    |
| `400`    | Slug com formato inválido.                                                 |
| `404`    | Barbearia inexistente, indisponível ou perfil não público.                 |
| `429`    | Limite atingido; o cabeçalho `Retry-After` indica quando tentar novamente. |
| `500`    | Erro interno inesperado.                                                   |
| `503`    | Serviço temporariamente indisponível ou proteção de pedidos indisponível.  |
| `204`    | Resposta a preflight `OPTIONS`.                                            |

Quando recebes `429`, respeita `Retry-After`, reduz a frequência de consulta e considera cachear a resposta. Evita loops de repetição imediata.

### Formato dos erros

As respostas de erro JSON contêm um campo `error`, com uma mensagem para diagnóstico básico:

```json
{
  "error": "Barbearia não encontrada."
}
```

As mensagens podem evoluir sem alterar o código HTTP. Para lógica da aplicação, usa o status HTTP; não uses a mensagem localizada como identificador de erro.

## 7. CORS e integração no browser

A rota pública permite leitura cross-origin:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Accept, If-None-Match`
- `Access-Control-Max-Age: 86400`

A API não usa cookies nem credenciais CORS. Não precisas de adicionar `credentials: "include"`; não o faças para este recurso. CORS controla como browsers permitem ler respostas, não substitui rate limiting nem limita clientes que chamem a API fora do browser.

## 8. Dados públicos e segurança

O contrato inclui apenas campos aprovados para publicação. Não devolve emails de proprietários, IDs de utilizadores, registos de clientes, marcações, dados de faturação, tokens privados, chaves de integração ou notas internas.

A API é de leitura e não autoriza operações de escrita. Não existe um recurso público para criar ou alterar uma landing page. Os campos públicos podem conter informação pessoal que a própria barbearia escolheu publicar, como telefone, morada comercial e nome apresentado numa avaliação; integra esses dados de acordo com a finalidade e as regras de privacidade do teu produto.

Não incluas secrets em código do browser. Para este recurso público não há segredo para distribuir aos clientes; se no futuro surgirem recursos privados, terão autenticação e autorização documentadas separadamente.

## 9. Landing page Enterprise

Uma barbearia com plano efetivo Enterprise e entitlement ativo pode ter a sua landing page em `/site/{slug}`. A URL absoluta é devolvida em `data.landingPage.url`; usa `available` em vez de assumir que todas as barbearias têm a página.

A ativação do benefício é controlada pelo backend e pela base de dados. A landing page utiliza o perfil e os serviços já existentes, pelo que não existe um segundo catálogo para manter. Quando o entitlement deixa de estar ativo, a página é suspensa e a API deixa de a anunciar como disponível.

## 10. Versões e compatibilidade

O caminho `/api/v1/` identifica a versão principal. Dentro de v1:

- Os consumidores devem ignorar campos adicionais que não utilizem.
- Os consumidores devem tolerar campos declarados como `null`.
- Os consumidores devem validar o status HTTP antes de fazer parse do corpo.
- Mudanças incompatíveis serão publicadas numa nova versão principal, não silenciosamente dentro de v1.

A especificação machine-readable está em [`public/openapi-v1.yaml`](../public/openapi-v1.yaml) e, após o deploy, em [`https://barbers.silentra.me/openapi-v1.yaml`](https://barbers.silentra.me/openapi-v1.yaml).

## 11. FAQ e resolução de problemas

**Preciso de uma chave API?** Não para o endpoint público de perfil. Não envies tokens de sessão nem segredos.

**Porque recebi 404?** Confirma o slug, se o perfil está publicado e se a barbearia continua disponível no diretório público.

**Porque recebi 429?** A tua origem excedeu o limite inicial. Respeita `Retry-After` e reutiliza cache.

**Porque recebi 503?** A API ou o serviço partilhado de limitação de pedidos está temporariamente indisponível. Recuar com espera progressiva é preferível a repetir imediatamente.

**Porque `landingPage.available` é falso?** O plano efetivo pode não ser Enterprise ou o entitlement da página pode estar suspenso.

**Posso usar esta API para fazer marcações?** Não diretamente. Usa `bookingUrl` para encaminhar o cliente para a página de marcação suportada pela Silentra.

## 12. Rollout operacional

Para publicar a funcionalidade Enterprise e a nova API:

1. Rever `supabase/migrations/20261014230000_enterprise_landing_pages_public_api.sql`.
2. Aplicar a migration no projeto Supabase correto usando o processo de release autorizado.
3. Fazer deploy da versão da aplicação que contém a rota API e a landing page.
4. Confirmar o endpoint com uma barbearia de teste cujo perfil público esteja ativo.
5. Validar `200`, `304`, slug inválido (`400`), perfil indisponível (`404`), limite (`429`) e comportamento temporário (`503`) no ambiente de teste.
6. Confirmar que Enterprise ativo anuncia a landing page e que Free/Pro ou downgrade não a anunciam como ativa.

Esta documentação descreve o contrato implementado. A disponibilidade efetiva em produção depende de a migration e o deploy estarem aplicados.
