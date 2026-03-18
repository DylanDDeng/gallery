# Image Web

AI image generation site built with Next.js, Supabase, and a credits-based billing model.

## What It Does

- Users sign in and buy credits.
- Credits are spent when generating images.
- Purchase flow supports a switchable hosted checkout provider.

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Billing Setup

Use the environment variables in `.env.example` to configure billing:

- `PAYMENT_PROVIDER` to choose `stripe` or `paddle`.
- `NEXT_PUBLIC_BASE_URL` for success and cancel redirects.
- `NEXT_PUBLIC_BILLING_ENABLED` to turn the public billing flow on or off.
- `NEXT_PUBLIC_SELF_SERVICE_API_KEYS_ENABLED` to allow or disallow user-managed provider API keys.
- `DOUBAO_API_KEY` for server-managed image generation when self-service API keys are disabled.
- `USER_API_KEYS_ENCRYPTION_KEY` to encrypt user-supplied API keys at rest when self-service API keys are enabled.
- Stripe:
  - `BILLING_STRIPE_SECRET_KEY` and `BILLING_STRIPE_WEBHOOK_SECRET` as preferred Vercel-safe aliases
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_SMALL`, `STRIPE_PRICE_MEDIUM`, `STRIPE_PRICE_LARGE`, `STRIPE_PRICE_PRO`
- Paddle:
  - `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
  - `PADDLE_API_KEY`
  - `PADDLE_WEBHOOK_SECRET`
  - `PADDLE_PRICE_SMALL`, `PADDLE_PRICE_MEDIUM`, `PADDLE_PRICE_LARGE`, `PADDLE_PRICE_PRO`
  - Set your Paddle default payment link to `/checkout/default`.
  - Approve your site in Paddle Checkout settings before going live.
  - Point Paddle webhooks to `/api/webhooks/paddle`.

## Billing Flow

1. User opens the credits page and selects a credit bundle.
2. The app creates a provider-specific hosted checkout session.
3. The selected payment provider confirms the payment through a webhook.
4. The order is marked complete and credits are added to the user account.

## Local Notes

- Keep the credit bundle definitions in sync with the configured price IDs for the active provider.
- Do not expose secret payment provider keys to the client.
- The credit balance is the source of truth for image generation.
