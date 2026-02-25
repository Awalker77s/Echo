# Echo Journal

Voice-first journaling app (React + TypeScript + Tailwind + Supabase + Stripe).

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI
- A Supabase project
- OpenAI API key
- Stripe account and products/prices

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment variables

```bash
cp .env.example .env
```

Fill every required variable in `.env`.

## 3) Supabase setup

### Database + policies

```bash
supabase db push
```

This applies migrations in `supabase/migrations` (tables, RLS, gift/memoir tables).

### Storage bucket

Create bucket **`journal-audio`** in Supabase Storage (private).

### Auth providers

In Supabase Auth settings:
- Enable **Email/Password**
- Enable **Google OAuth**
- Add redirect URL(s), e.g. `http://localhost:5173`

## 4) Deploy edge functions

Deploy each function (or all):

```bash
supabase functions deploy process-recording
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy weekly-summary
supabase functions deploy pattern-recognition
supabase functions deploy generate-chapter
supabase functions deploy export-data
supabase functions deploy create-gift-checkout
supabase functions deploy redeem-gift
supabase functions deploy order-memoir
```

Set function secrets from `.env`:

```bash
supabase secrets set --env-file .env
```

## 5) Stripe configuration

1. Create products/prices for Core, Memoir, and Lifetime.
2. Put resulting price IDs in:
   - `STRIPE_PRICE_CORE`
   - `STRIPE_PRICE_MEMOIR`
   - `STRIPE_PRICE_LIFETIME`
3. Create webhook endpoint pointing to:
   - `/functions/v1/stripe-webhook`
4. Subscribe to events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
5. Save webhook signing secret in `STRIPE_WEBHOOK_SECRET`.

## 6) Run the app

```bash
npm run dev
```

App title: **Echo Journal**.

## Useful scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```
