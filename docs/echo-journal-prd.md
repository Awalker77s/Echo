# Echo Journal — Product Requirements Document (PRD)
## For Codex Implementation

**Version 1.0 | 2025**

---

## 1. Executive Summary

Echo Journal is a voice-first journaling application that transforms spoken words into clean, structured journal entries using AI. The app transcribes voice recordings, generates polished journal entries, detects mood and emotional patterns, extracts key ideas and themes, and builds a personal timeline that grows over time. The core value proposition is removing all friction from journaling by making it as easy as talking.

**Tagline:** *Speak. Remember. Understand Yourself.*

---

## 2. Product Vision & Goals

### 2.1 Vision Statement

A journal that listens to you, understands you, and remembers everything. Echo Journal makes self-reflection effortless by turning natural speech into meaningful, organized personal records enriched with emotional intelligence.

### 2.2 Core Goals

1. **Eliminate friction:** Recording a journal entry should take under 5 seconds to initiate.
2. **AI-powered transformation:** Raw speech becomes clean, readable entries that sound like the user but read like polished writing.
3. **Emotional intelligence:** Automatically detect and track mood, patterns, and recurring themes over time.
4. **Long-term value:** Create an irreplaceable personal archive that becomes more valuable with continued use.
5. **Privacy first:** All data encrypted, never shared, never used for advertising.

### 2.3 Success Metrics

| Metric | Target |
|--------|--------|
| Time to first recording | < 10 seconds from app open |
| Daily active recording rate | > 40% of weekly active users |
| 30-day retention | > 60% |
| 90-day retention | > 45% |
| Free-to-paid conversion | > 8% within 30 days |
| Average recording length | 45–120 seconds |
| App Store rating | > 4.7 stars |

---

## 3. User Personas

### 3.1 Primary: The Busy Reflector
Age 25–45, knowledge worker or creative professional. Knows journaling is beneficial but has never maintained the habit. Values self-awareness and personal growth but has limited free time. Comfortable with voice interfaces and AI tools.

### 3.2 Secondary: The Therapy Companion
Age 20–55, currently in therapy or coaching. Wants to process emotions between sessions. Needs a low-friction way to capture thoughts when feelings surface. Their therapist may recommend the app.

### 3.3 Tertiary: The Memory Keeper
Age 35–65, parent or grandparent who wants to preserve memories and life stories. Motivated by the physical memoir feature. Values the idea of leaving a record for family.

---

## 4. Technical Architecture

### 4.1 System Overview

The application follows a client-server architecture with a React/React Native frontend, a Supabase backend for authentication, database, and file storage, and external AI APIs for transcription, journal generation, and mood analysis.

### 4.2 Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend (Web) | React 18+ with TypeScript, Tailwind CSS |
| Frontend (Mobile) | React Native with Expo |
| Voice Recording | Browser MediaRecorder API / Expo AV |
| Voice Transcription | OpenAI Whisper API |
| Journal Generation | GPT-4o with custom system prompts |
| Mood Analysis | GPT-4o with structured output + sentiment scoring |
| Backend / Database | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| Payments | Stripe (subscriptions + one-time purchases) |
| Physical Memoirs | Printful or Blurb API (print-on-demand) |
| Hosting | Vercel (web) / Expo EAS (mobile builds) |
| Monitoring | Sentry for errors, PostHog for analytics |

### 4.3 Architecture Flow

```text
[Client App] → [Supabase Edge Functions] → [OpenAI Whisper API] → Transcription
[Client App] → [Supabase Edge Functions] → [GPT-4o] → Journal Entry + Mood + Ideas
[Client App] → [Supabase Auth] → User Management
[Client App] → [Supabase Storage] → Audio Files (encrypted)
[Client App] → [Supabase PostgreSQL] → Entries, Moods, Ideas, Patterns
[Supabase Edge Functions] → [Stripe API] → Payments
```

---

## 5. Database Schema

### 5.1 `users`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Supabase auth user ID |
| email | TEXT | User email address |
| display_name | TEXT | User display name |
| plan | ENUM | free, core, memoir, lifetime |
| stripe_customer_id | TEXT | Stripe customer reference |
| stripe_subscription_id | TEXT | Active subscription ID |
| recording_count | INTEGER | Total recordings (for free tier limits) |
| timezone | TEXT | User timezone for time-of-day analysis |
| created_at | TIMESTAMPTZ | Account creation date |
| updated_at | TIMESTAMPTZ | Last profile update |

### 5.2 `journal_entries`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Entry unique identifier |
| user_id | UUID (FK → users.id) | Owner |
| audio_url | TEXT | Supabase Storage path to audio file |
| raw_transcript | TEXT | Raw Whisper transcription |
| cleaned_entry | TEXT | GPT-4o generated journal entry |
| entry_title | TEXT | AI-generated title for the entry |
| duration_seconds | INTEGER | Recording length in seconds |
| mood_primary | TEXT | Primary detected mood |
| mood_score | FLOAT | Sentiment score (-1.0 to 1.0) |
| mood_tags | TEXT[] | Array of mood descriptors |
| themes | TEXT[] | Extracted themes/topics |
| people_mentioned | TEXT[] | Names of people mentioned |
| word_count | INTEGER | Word count of cleaned entry |
| recorded_at | TIMESTAMPTZ | When the user made the recording |
| created_at | TIMESTAMPTZ | Processing completion time |

### 5.3 `ideas`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Idea unique identifier |
| user_id | UUID (FK → users.id) | Owner |
| entry_id | UUID (FK → journal_entries.id) | Source journal entry |
| content | TEXT | The extracted idea text |
| category | TEXT | business, creative, goal, action, other |
| is_starred | BOOLEAN | User-starred important ideas |
| created_at | TIMESTAMPTZ | Extraction timestamp |

### 5.4 `mood_history`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Record identifier |
| user_id | UUID (FK → users.id) | Owner |
| entry_id | UUID (FK → journal_entries.id) | Source journal entry |
| mood_primary | TEXT | Primary mood label |
| mood_score | FLOAT | Sentiment score (-1.0 to 1.0) |
| mood_tags | TEXT[] | Mood descriptor tags |
| recorded_at | TIMESTAMPTZ | Time of recording |

### 5.5 `patterns`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Pattern identifier |
| user_id | UUID (FK → users.id) | Owner |
| pattern_type | TEXT | recurring_topic, mood_trigger, time_pattern, person_association |
| description | TEXT | Human-readable pattern description |
| evidence | JSONB | Array of entry_ids and quotes supporting the pattern |
| confidence | FLOAT | Confidence score (0.0 to 1.0) |
| surfaced_at | TIMESTAMPTZ | When pattern was first detected |
| dismissed | BOOLEAN | User dismissed this insight |

### 5.6 `chapter_reports`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Report identifier |
| user_id | UUID (FK → users.id) | Owner |
| month | DATE | First day of the reported month |
| title | TEXT | AI-generated chapter title |
| narrative | TEXT | Full chapter report narrative |
| top_themes | TEXT[] | Top themes for the month |
| mood_summary | JSONB | Mood distribution and trends |
| growth_moments | JSONB | Key growth/change moments |
| entry_count | INTEGER | Number of entries that month |
| created_at | TIMESTAMPTZ | Report generation timestamp |

### 5.7 Row Level Security

All tables must enforce RLS so users can only access their own data. Every table with a `user_id` column must have a policy: `auth.uid() = user_id`. The audio storage bucket must also enforce per-user access via storage policies.

---

## 6. API Endpoints (Supabase Edge Functions)

### 6.1 Recording & Processing

**`POST /functions/v1/process-recording`**

The primary endpoint. Accepts an audio file, processes it through the full AI pipeline, and returns the completed journal entry.

- **Request:** multipart/form-data with audio file (webm/m4a/mp4, max 25MB)
- **Processing Pipeline:**
  1. Upload audio to Supabase Storage (encrypted bucket)
  2. Send audio to OpenAI Whisper API for transcription
  3. Send transcript to GPT-4o for journal entry generation (custom system prompt)
  4. Send transcript to GPT-4o for mood analysis (structured JSON output)
  5. Send transcript to GPT-4o for idea extraction (structured JSON output)
  6. Store all results in database tables
  7. Return complete entry object to client
- **Response:** `{ id, entry_title, cleaned_entry, mood_primary, mood_score, mood_tags, themes, ideas: [{ id, content, category }], duration_seconds, recorded_at }`

### 6.2 Journal Entries

| Endpoint | Description |
|----------|-------------|
| `GET /functions/v1/entries` | List entries (paginated, filterable by date range, mood) |
| `GET /functions/v1/entries/:id` | Get single entry with full details |
| `DELETE /functions/v1/entries/:id` | Delete entry and associated audio |
| `PATCH /functions/v1/entries/:id` | Edit cleaned entry text (user corrections) |

### 6.3 Mood & Insights

| Endpoint | Description |
|----------|-------------|
| `GET /functions/v1/mood-history` | Mood data points for graph (date range param) |
| `GET /functions/v1/patterns` | Active pattern insights for the user |
| `POST /functions/v1/patterns/:id/dismiss` | Dismiss a pattern insight |
| `GET /functions/v1/weekly-summary` | Generate weekly insight summary |

### 6.4 Ideas Vault

| Endpoint | Description |
|----------|-------------|
| `GET /functions/v1/ideas` | List all ideas (filterable by category, starred) |
| `PATCH /functions/v1/ideas/:id` | Toggle star, edit idea text |
| `DELETE /functions/v1/ideas/:id` | Delete an idea |

### 6.5 Chapter Reports

| Endpoint | Description |
|----------|-------------|
| `POST /functions/v1/generate-chapter` | Generate monthly chapter report (cron or manual) |
| `GET /functions/v1/chapters` | List all chapter reports |
| `GET /functions/v1/chapters/:id` | Get single chapter report |

### 6.6 User & Payments

| Endpoint | Description |
|----------|-------------|
| `POST /functions/v1/create-checkout` | Create Stripe Checkout session for plan upgrade |
| `POST /functions/v1/stripe-webhook` | Handle Stripe webhook events (subscription lifecycle) |
| `GET /functions/v1/user-profile` | Get user profile and current plan details |
| `PATCH /functions/v1/user-profile` | Update profile settings (timezone, display name) |
| `POST /functions/v1/cancel-subscription` | Cancel active subscription |

---

## 7. AI Prompt Specifications

### 7.1 Journal Entry Generation

- **Model:** GPT-4o
- **Temperature:** 0.7
- **Max Tokens:** 2000
- **System Prompt Intent:** Transform raw speech transcription into a clean, personal journal entry. Preserve the speaker's voice, personality, and specific details. Remove filler words (um, uh, like, you know), false starts, and repetitions. Organize rambling thoughts into coherent paragraphs. Do not add information not present in the transcript. Do not editorialize or add AI commentary. Keep it first-person. Generate a short, evocative title.
- **Output Format:** JSON → `{ title: string, entry: string (markdown-formatted) }`

### 7.2 Mood Analysis

- **Model:** GPT-4o
- **Temperature:** 0.3
- **System Prompt Intent:** Analyze the transcript for emotional content. Determine the primary mood from a fixed set: happy, excited, grateful, calm, reflective, neutral, anxious, stressed, frustrated, sad, angry, confused, hopeful, nostalgic, determined. Provide a sentiment score from -1.0 (very negative) to 1.0 (very positive). List up to 5 mood descriptor tags. Analyze word choice, sentence structure, topic sentiment, and expressed feelings.
- **Output Format:** JSON → `{ mood_primary: string, mood_score: float, mood_tags: string[] }`

### 7.3 Idea Extraction

- **Model:** GPT-4o
- **Temperature:** 0.3
- **System Prompt Intent:** Extract any distinct ideas, goals, plans, creative thoughts, business ideas, things the speaker wants to do, or action items mentioned in the transcript. Categorize each as: business, creative, goal, action, or other. Only extract genuine ideas; do not fabricate. Return an empty array if no ideas are present.
- **Output Format:** JSON → `{ ideas: [{ content: string, category: string }] }`

### 7.4 Pattern Recognition

- **Model:** GPT-4o
- **Trigger:** Run weekly via cron job, analyzing all entries from the past 30 days.
- **System Prompt Intent:** Analyze a collection of journal entries to identify recurring patterns. Look for: recurring topics or concerns, mood triggers and correlations, time-of-day emotional patterns, frequently mentioned people in specific emotional contexts, and goals or desires that keep resurfacing. Present each pattern as a gentle, conversational insight. Provide a confidence score.
- **Output Format:** JSON → `[{ pattern_type: string, description: string, evidence: [{ entry_id: string, quote: string }], confidence: float }]`

### 7.5 Monthly Chapter Report

- **Model:** GPT-4o
- **Temperature:** 0.8
- **Trigger:** Run on the 1st of each month for the previous month, or on-demand.
- **System Prompt Intent:** Synthesize all journal entries from a given month into a personal narrative chapter. Write in third-person reflective style, like a compassionate biographer. Highlight emotional arcs, growth moments, recurring themes, and significant events. Include a chapter title. The tone should be warm, insightful, and meaningful. This should read like a chapter of a memoir.
- **Output Format:** JSON → `{ title: string, narrative: string, top_themes: string[], mood_summary: object, growth_moments: array }`

---

## 8. Screens & User Interface

### 8.1 Screen Inventory

| Screen | Description |
|--------|-------------|
| Onboarding (3 slides) | Welcome, value prop, permission request (microphone) |
| Sign Up / Login | Email + password or social auth via Supabase |
| Home / Record | Single large record button, today's entry count, streak counter |
| Recording Active | Live waveform visualization, timer, stop button |
| Processing | Animated loader while AI pipeline runs (~10–20 seconds) |
| Entry View | Formatted journal entry with mood tag, themes, ideas, audio playback |
| Timeline / History | Scrollable list of past entries, filterable by date and mood |
| Mood Dashboard | Interactive mood graph (line chart over time), mood distribution |
| Ideas Vault | Categorized list of extracted ideas, star and filter functionality |
| Insights | Pattern cards with descriptions and supporting evidence |
| Chapter Reports | Monthly narrative chapters, browsable by month |
| Settings | Account, subscription management, privacy, data export, delete account |
| Paywall | Plan comparison, upgrade flow via Stripe Checkout |

### 8.2 Design Principles

- **Zero friction:** The record button must be reachable within 1 tap from app open.
- **Calm aesthetic:** Soft gradients, muted colors, generous whitespace. No visual clutter.
- **Delight in discovery:** Mood graphs and chapter reports should feel like uncovering something about yourself.
- **Mobile-first:** Every screen designed for thumb-zone on mobile. Web is a secondary layout.
- **Accessibility:** WCAG 2.1 AA compliance. VoiceOver/TalkBack compatible.

### 8.3 Key UI Components

- **Record Button:** Large, circular, centered. Pulsing animation when idle. Morphs into waveform when recording.
- **Waveform Visualizer:** Real-time audio visualization during recording. Uses Web Audio API / Expo Audio.
- **Mood Graph:** Line chart built with Recharts (web) or Victory Native (mobile). Displays mood_score over time with color-coded zones.
- **Entry Card:** Preview card showing title, first line, mood tag pill, date. Tappable to expand.
- **Insight Card:** Pattern insight with description, confidence indicator, and "Show Me" link to supporting entries.
- **Chapter View:** Long-form reading view with memoir-style typography. Share and print buttons.

---

## 9. Core User Flows

### 9.1 First Recording Flow

1. User opens app for the first time → sees onboarding carousel (3 slides).
2. User creates account (email/password or OAuth).
3. App requests microphone permission with context explaining why.
4. User lands on Home screen with prominent record button and a prompt: "What's on your mind?"
5. User taps record → waveform appears, timer starts.
6. User speaks for any duration, taps stop.
7. Processing screen displays (~10–20 seconds) with animated indicator and encouraging copy.
8. Entry view appears: clean journal entry, mood tag, themes. Celebratory micro-animation.
9. Tooltip guides user to explore mood graph and ideas.

### 9.2 Returning User Flow

1. User opens app → Home screen with record button, streak counter, and today's mood snapshot.
2. If new insights are available, a subtle notification dot appears on the Insights tab.
3. User taps record, speaks, receives entry.
4. User can scroll Timeline to review past entries.

### 9.3 Upgrade Flow

1. Free user hits 5-recording monthly limit → paywall appears.
2. Paywall shows plan comparison (Free vs Core vs Memoir vs Lifetime).
3. User selects plan → Stripe Checkout session opens.
4. On successful payment, Stripe webhook updates user plan in database.
5. User returns to app with unlocked features.

---

## 10. Monetization & Pricing

### 10.1 Pricing Tiers

| Plan | Price | Features |
|------|-------|----------|
| Free | £0/mo | 5 recordings/month, basic transcription, simple mood tag, 7-day history |
| Core | £7/mo | Unlimited recordings, full mood graph, Idea Vault, 1-year history, weekly insights email |
| Memoir | £12/mo | Everything in Core + monthly Chapter Reports, Pattern Recognition, lifetime archive, physical memoir printing (yearly add-on) |
| Lifetime | £99 once | Everything forever, no subscription, annual printed memoir included |

### 10.2 Additional Revenue Streams

- Physical memoir book printing: £39–£59 per book (print-on-demand via Printful/Blurb)
- Gift subscriptions: purchasable for others, redeemable via code
- B2B sales: Professional dashboard for therapists and coaches (future V2)

### 10.3 Stripe Implementation

- Create Stripe Products for each plan with monthly Price objects
- Lifetime plan uses a one-time Payment Intent, not a subscription
- Stripe Checkout for payment collection (hosted, PCI-compliant)
- Stripe Customer Portal for self-service subscription management
- Webhook handler for events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## 11. Security & Privacy Requirements

1. All audio files encrypted at rest in Supabase Storage.
2. All API communication over HTTPS/TLS 1.3.
3. Supabase Row Level Security (RLS) on every table. Users can only access their own data.
4. Audio files stored in per-user prefixed paths with storage policies.
5. No analytics or tracking of journal content. Only aggregate, anonymized usage metrics.
6. Data export: Users can export all their data as JSON at any time.
7. Account deletion: Full deletion of all data including audio files, entries, and analytics.
8. OpenAI API calls use the data retention opt-out to prevent training on user data.
9. Privacy policy must clearly state: no data selling, no ad targeting, no third-party content access.

---

## 12. Phased Build Roadmap

### Phase 1 — MVP (Weeks 1–4)

**Goal:** Core recording-to-entry loop functional and deployed.

| Task | Priority | Details |
|------|----------|---------|
| Project setup | P0 | Initialize React/React Native project, Supabase project, Stripe account |
| Authentication | P0 | Supabase Auth with email/password and Google OAuth |
| Voice recording UI | P0 | Record button, waveform visualization, timer, stop/submit |
| Audio upload | P0 | Upload to Supabase Storage with per-user encryption |
| Whisper transcription | P0 | Edge Function: send audio to Whisper, return transcript |
| Journal generation | P0 | Edge Function: send transcript to GPT-4o, return cleaned entry |
| Basic mood tagging | P0 | Edge Function: single mood label and score from GPT-4o |
| Entry storage & display | P0 | Save to database, display formatted entry with mood tag |
| Entry history / timeline | P1 | Scrollable list of past entries with date grouping |
| Stripe integration | P1 | Checkout session creation, webhook handler, plan gating |
| Free tier limits | P1 | Enforce 5 recordings/month and 7-day history for free users |

### Phase 2 — Growth Features (Weeks 5–8)

**Goal:** Engagement and retention features that make the app indispensable.

| Task | Priority | Details |
|------|----------|---------|
| Mood graph | P0 | Interactive line chart of mood_score over time with filters |
| Idea extraction | P0 | GPT-4o extracts ideas per entry, stores in ideas table |
| Ideas Vault UI | P0 | Categorized, filterable, starrable list of extracted ideas |
| Weekly insight emails | P1 | Cron job generates summary, sends via email (Resend or Supabase) |
| Mobile optimization | P1 | Responsive design pass, touch targets, swipe gestures |
| Entry editing | P1 | Allow users to edit AI-generated entry text |
| Audio playback | P2 | Play back original recording from entry view |
| Search | P2 | Full-text search across journal entries |

### Phase 3 — Sticky & Differentiation (Months 3–4)

**Goal:** Features that create deep emotional attachment and long-term value.

| Task | Priority | Details |
|------|----------|---------|
| Pattern Recognition | P0 | Weekly cron analyzes 30-day window, surfaces insights |
| Insights UI | P0 | Card-based insight display with supporting evidence links |
| Monthly Chapter Reports | P0 | Cron job on 1st of month generates narrative chapter |
| Chapter Report UI | P0 | Memoir-style reading view with share functionality |
| Physical memoir integration | P1 | Blurb/Printful API to order printed book of chapters |
| Shareable mood summaries | P2 | Exportable mood cards for social sharing |
| Data export | P2 | JSON export of all user data |
| Gift subscriptions | P2 | Purchase and redeem subscription gift codes via Stripe |

---

## 13. Testing Requirements

### 13.1 Unit Tests
- AI prompt functions: Verify structured output parsing for mood, ideas, and journal generation.
- Stripe webhook handler: Test all event types with mock payloads.
- Free tier enforcement: Verify recording limits and history restrictions.
- RLS policies: Confirm users cannot access other users' data.

### 13.2 Integration Tests
- Full recording pipeline: Audio upload → transcription → entry generation → storage → display.
- Payment flow: Checkout → webhook → plan upgrade → feature unlock.
- Pattern recognition: Seed entries → run analysis → verify insight quality.

### 13.3 E2E Tests
- First-time user onboarding through first recording.
- Free user hits limit and upgrades.
- 30-day user receives first Chapter Report.

---

## 14. Environment Variables

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public anon key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | OpenAI API key for Whisper and GPT-4o |
| `STRIPE_SECRET_KEY` | Stripe secret key for server-side operations |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for client-side |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_CORE` | Stripe Price ID for Core plan |
| `STRIPE_PRICE_MEMOIR` | Stripe Price ID for Memoir plan |
| `STRIPE_PRICE_LIFETIME` | Stripe Price ID for Lifetime one-time |

---

## 15. Out of Scope (V1)

- B2B professional dashboard for therapists/coaches
- Multi-language transcription and journal generation
- Real-time collaborative journaling
- Apple Watch / wearable companion app
- Custom AI voice responses or conversational prompting
- Integration with external health apps (Apple Health, Fitbit)
- Offline recording with sync (requires significant additional architecture)

These features are documented for V2 consideration after product-market fit is validated.

---

> *"Your voice is the most honest diary you'll ever keep."*
>
> Echo Journal — Built to remember everything that matters.
