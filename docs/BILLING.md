# Billing

## Providers

O Silentra for Barbers suporta **Manual** e **Stripe**.

O provider é uma propriedade da subscrição e não deve ser inferido apenas pelo modo global atual.

## Manual billing

```text
Barbearia
   │
   ▼
Pedido de subscrição
   │
   ▼
Admin revê pedido
   │
   ├── envia link de pagamento
   └── confirma pagamento
          │
          ▼
Subscrição ativa
```

O preço e período aplicáveis ao pedido devem ficar snapshotados no momento da criação. Alterar preços configurados posteriormente não deve alterar pedidos existentes.

## Stripe

```text
Cliente → Backend → Stripe Checkout → Webhook → Backend → Subscrição
```

O cliente não deve conseguir escolher arbitrariamente um Stripe Price ID para obter acesso a outro plano. A seleção deve ser resolvida e verificada no backend.

## Webhooks

Webhooks Stripe devem validar assinatura, identificar o evento, verificar a subscrição/provider, processar de forma idempotente e nunca confiar em dados do browser.

## Mudança de modo

Manual → Stripe:
- novas subscrições seguem Stripe;
- subscrições Manual existentes continuam Manual.

Stripe → Manual:
- novas subscrições seguem Manual;
- subscrições Stripe existentes continuam Stripe.

Não existe migração automática entre providers.

## Variáveis

Ver [.env.example](../.env.example) para Stripe, manual pricing, payment host allowlist e Customer Portal.

Nunca guardar secrets no repositório.
