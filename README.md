# Image Web

AI image generation site built with Next.js, Supabase, and a credits-based billing model.

## What It Does

- Users sign in and buy credits.
- Credits are spent when generating images.
- Purchase flow is designed around Paddle hosted checkout for a simpler global payment setup.

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Paddle Setup

Use the environment variables in `.env.example` to configure billing:

- `NEXT_PUBLIC_BASE_URL` for success and cancel redirects.
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` for Paddle.js on the checkout landing page.
- `PADDLE_API_KEY` for server-side checkout and order creation.
- `PADDLE_WEBHOOK_SECRET` for webhook verification.
- `PADDLE_PRICE_SMALL`, `PADDLE_PRICE_MEDIUM`, `PADDLE_PRICE_LARGE`, `PADDLE_PRICE_PRO` for credit bundle mapping.
- Set your Paddle default payment link to `/checkout/default`.
- Approve your site in Paddle Checkout settings before going live.
- Point Paddle webhooks to `/api/webhooks/paddle`.

## Billing Flow

1. User opens the credits page and selects a credit bundle.
2. The app creates a Paddle transaction and redirects to a hosted checkout landing page.
3. Paddle confirms the payment through a webhook.
4. The order is marked complete and credits are added to the user account.

## Local Notes

- Keep the credit bundle definitions in sync with the price IDs configured in Paddle.
- Do not expose secret Paddle keys to the client.
- The credit balance is the source of truth for image generation.
