#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

# Set required secrets (replace placeholder values before running in a real environment)
supabase secrets set OPENAI_API_KEY="your-openai-api-key"
supabase secrets set STRIPE_SECRET_KEY="your-stripe-secret-key"
supabase secrets set STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"

# Deploy all Edge Functions in supabase/functions/
supabase functions deploy process-recording
supabase functions deploy create-checkout
supabase functions deploy create-gift-checkout
supabase functions deploy stripe-webhook
supabase functions deploy weekly-summary
supabase functions deploy pattern-recognition
supabase functions deploy generate-chapter
supabase functions deploy export-data
supabase functions deploy redeem-gift
supabase functions deploy order-memoir

echo "Supabase function deployment completed."
