# Echo Journal (Phases 1–3)

React + TypeScript + Tailwind web app with Supabase Auth, voice journaling, AI processing, Stripe billing, and retention-focused features.

## Structure
- `src/components`
- `src/pages`
- `src/lib`
- `src/hooks`
- `supabase/migrations`
- `supabase/functions`

## Setup
1. Copy `.env.example` to `.env` and fill values.
2. Install deps: `npm install`
3. Run web app: `npm run dev`
4. Apply migrations with Supabase CLI.
5. Deploy edge functions in `supabase/functions`.

## Implemented scope
### Phase 1
- Auth: email/password + Google OAuth.
- Protected routes.
- Home recording UI with waveform and timer.
- `process-recording` function with Whisper + GPT-4o pipeline and DB writes.
- Entry view and timeline grouped by date.
- Stripe checkout and webhook functions.
- Free-tier gating: 5 recordings/month and 7-day history.

### Phase 2
- Mood dashboard graph (`/mood`) using Recharts.
- Ideas Vault (`/ideas`) with category/star filters and search.
- Timeline full-text search.
- Entry editing and original-audio playback.
- Weekly summary generation + optional Resend email send (`weekly-summary`).

### Phase 3
- `pattern-recognition` edge function for 30-day GPT-based pattern extraction into `patterns`.
- Insights page (`/insights`) with confidence badges, supporting-entry links, and dismiss action.
- `generate-chapter` edge function for monthly narrative reports into `chapter_reports`.
- Chapter Reports page (`/chapters`) with memoir-style reading + share/print actions.
- Settings page (`/settings`) with full JSON data export (`export-data`) and downloadable mood summary cards.
- Gift subscription flow (`/gifts`) with `create-gift-checkout` + `redeem-gift` and gift code fulfillment via Stripe webhook.
- Physical memoir print scaffold (`/memoir-print`) with placeholder provider call through `order-memoir`.
