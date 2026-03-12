# Echo

Echo is a **voice-first AI journaling application** that turns spoken reflections into structured insights. Users record journal entries, the app transcribes audio with Whisper, and AI workflows generate sentiment signals, key ideas, and concise summaries.

## Why Echo
- Capture thoughts faster than typing with voice-first journaling.
- Convert unstructured reflections into searchable, actionable insights.
- Provide recurring AI analysis to support personal growth and self-awareness.

## Key Features
- Voice journal recording and secure audio storage.
- Speech-to-text transcription via OpenAI Whisper (through Supabase Edge Functions).
- AI-generated sentiment analysis and thematic pattern recognition.
- Idea extraction and summary generation for each entry.
- Weekly summaries and long-form outputs (chapters/memoir flows).
- Stripe-powered subscription and checkout workflows.

## AI Pipeline Architecture
Echo uses a frontend + serverless pipeline:

1. **Client (React + TypeScript + Vite)** captures and uploads recordings.
2. **Supabase** manages auth, database, and private storage.
3. **Supabase Edge Functions (Deno)** orchestrate AI processing.
4. **OpenAI APIs** perform transcription and language analysis.
5. Processed insights are saved back to Supabase and rendered in the UI.

## Voice → Insight Pipeline
1. **Voice recording**
   - User records an entry in the web app.
   - Audio is uploaded to a private Supabase Storage bucket.
2. **Speech-to-text (Whisper)**
   - `process-recording` edge function transcribes audio using Whisper.
   - Transcript is persisted in Supabase.
3. **Sentiment analysis**
   - AI evaluates emotional tone and trend direction from transcript text.
4. **Idea extraction**
   - AI identifies key ideas, themes, and notable moments.
5. **AI-generated summaries**
   - Additional functions create concise entry summaries, patterns, and weekly rollups.

## Tech Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **AI:** OpenAI (Whisper + LLM analysis)
- **Payments:** Stripe
- **Tooling:** ESLint, Vitest

## Local Development
### Prerequisites
- Node.js 20+
- npm 10+
- Supabase CLI
- Supabase project
- OpenAI API key
- Stripe account (for billing flows)

### Setup
```bash
npm install
cp .env.example .env
```

Fill required environment variables in `.env` (see next section), then run:

```bash
npm run dev
```

### Supabase workflows
```bash
supabase db push
./scripts/deploy-supabase.sh
```

## Required Environment Variables
Copy `.env.example` to `.env` and set values before running locally.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `VITE_OPENAI_API_KEY` *(current client-side usage; recommended to move all OpenAI calls server-side for production hardening)*
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_CORE`
- `STRIPE_PRICE_MEMOIR`
- `STRIPE_PRICE_LIFETIME`
- `SITE_URL`

## Security Notes
- Never commit `.env` files or real API keys.
- Keep server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`) in secure secret managers.
- Prefer server-side AI calls over exposing provider keys in frontend runtime variables.

## Scripts
```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
```
