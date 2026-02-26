#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install from https://supabase.com/docs/guides/cli first." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing .env file in project root." >&2
  exit 1
fi

echo "Loading env secrets..."
supabase secrets set --env-file .env

echo "Applying migrations..."
supabase db push

echo "Deploying edge functions..."
for fn in process-recording create-checkout create-gift-checkout stripe-webhook weekly-summary pattern-recognition generate-chapter export-data redeem-gift order-memoir; do
  supabase functions deploy "$fn"
done

echo "Done."
