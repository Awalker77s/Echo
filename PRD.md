# Echo — Product Requirements Document (PRD)
### For AI Agent Code Generation | Version 1.0 | February 2026

---

## 1. Product Overview

**Product Name:** Echo  
**Tagline:** *Your emotions, translated.*  
**Type:** AI-powered passive mood journaling web + mobile application  
**Core Concept:** Echo eliminates the friction of traditional journaling by replacing writing with presence. Users submit a selfie, short video (5–15 seconds), or uploaded clip. Echo's AI pipeline analyzes facial expressions, micro-expressions, eye movement, voice tone, speech speed, and energy level — then auto-generates a structured mood entry, emotional insight, reflection paragraph, and mood tag. All entries are logged to a personal emotional data dashboard.

**Problem Being Solved:** Most people do not journal consistently because it requires effort, vocabulary, and time. Echo makes emotional reflection passive — users simply show up, and the AI does the translation.

---

## 2. Goals & Success Metrics

### Primary Goals
- Deliver a frictionless mood-capture experience under 30 seconds per entry
- Generate AI reflections with >85% perceived accuracy (measured via user thumbs up/down feedback)
- Achieve daily active usage habit formation within 7 days of onboarding
- Reach 10,000 MAU within 6 months of launch

### KPIs
| Metric | Target |
|---|---|
| Daily Entry Completion Rate | >60% of active users |
| Avg. Session Duration | <45 seconds (MVP), <2 min (with analytics) |
| Day-7 Retention | >40% |
| Day-30 Retention | >20% |
| Free-to-Premium Conversion | >8% |
| NPS Score | >50 |

---

## 3. User Personas

### Persona 1 — The High Performer
- Age: 22–35 | Founder, student athlete, or ambitious professional
- Goal: Track mental state to optimize performance and prevent burnout
- Pain point: No time to journal; wants data on their mental patterns

### Persona 2 — The Self-Growth Seeker
- Age: 18–28 | Gen Z, wellness-conscious, TikTok/Instagram native
- Goal: Understand their emotional evolution over time
- Pain point: Journaling feels like homework; wants visual, shareable results

### Persona 3 — The Burnout-Aware Professional
- Age: 28–45 | Knowledge worker, manager, creative
- Goal: Catch stress accumulation before it becomes a crisis
- Pain point: Doesn't notice decline until it's severe

### Persona 4 — The Enterprise Team Lead *(Phase 2)*
- Age: 30–50 | HR director, team manager
- Goal: Monitor anonymous team emotional health at scale
- Pain point: No real-time signal on team wellbeing

---

## 4. Platform Targets

- **Web App (PWA):** Primary MVP target — React-based, mobile-first responsive
- **iOS App:** Phase 2 native build (React Native or Swift)
- **Android App:** Phase 2 native build (React Native or Kotlin)
- **Enterprise Portal:** Phase 3 admin dashboard (web only)

---

## 5. Technical Architecture

### 5.1 High-Level Stack

```text
Frontend:         React 18 + TypeScript + TailwindCSS + Framer Motion
Backend:          Node.js (Express) or Python (FastAPI) — recommended FastAPI for AI pipeline
Database:         PostgreSQL (structured data) + Redis (session/caching)
File Storage:     AWS S3 or Cloudflare R2 (encrypted media storage)
AI Pipeline:      Modular microservice architecture
Authentication:   Auth0 or Supabase Auth (OAuth2 + JWT)
Hosting:          Vercel (frontend) + AWS ECS / Railway (backend)
CDN:              Cloudflare
Queue System:     BullMQ or AWS SQS (for async AI processing)
```

### 5.2 AI Analysis Pipeline

The AI pipeline must be fully modular so individual models can be swapped without affecting the rest of the system. Each analysis module runs asynchronously and feeds results to an aggregator before GPT reflection generation.

```text
Input (image/video/audio)
        ↓
[Preprocessing Service]
  - Compress & normalize media
  - Extract audio track from video
  - Extract keyframes from video (at 0s, 50%, 100%)
        ↓
[Parallel Analysis Modules]
  ├── Facial Expression Module
  │     - Detect: happiness, sadness, anger, fear, disgust, surprise, neutrality
  │     - Detect: micro-expressions (brief involuntary expressions)
  │     - Tool: AWS Rekognition / Microsoft Azure Face API / Hume AI
  │
  ├── Eye Movement Module
  │     - Detect: eye contact stability, blink rate, gaze direction
  │     - Infer: focus level, fatigue, emotional avoidance
  │     - Tool: OpenCV (custom) or MediaPipe Face Mesh
  │
  ├── Voice Tone & Speech Module (video/audio only)
  │     - Detect: tone (warm, flat, tense, elevated), speech speed (WPM)
  │     - Detect: pauses, vocal tremor, energy in voice
  │     - Tool: Hume AI Expression API / AssemblyAI / Whisper + custom classifier
  │
  └── Energy Level Module
        - Derived signal from composite: movement in video, facial muscle tension, voice energy
        - Outputs: low / moderate / high energy score (0–100)
        ↓
[Signal Aggregator]
  - Combine all module outputs into structured JSON payload
  - Weight scores by media type (image = no voice/energy; video = full suite)
  - Generate composite emotional profile
        ↓
[Mood Tag Classifier]
  - Map composite profile to a primary mood tag
  - Tag vocabulary: calm, stressed, driven, low energy, optimistic, anxious,
    focused, disconnected, energized, melancholic, content, overwhelmed,
    excited, uncertain, grateful (extensible list)
  - Secondary tag also assigned for nuance (e.g., "stressed + driven")
        ↓
[GPT Reflection Generator]
  - Model: GPT-4o (or equivalent)
  - Prompt engineering: inject structured emotional JSON + date context
  - Outputs:
      1. Mood Summary (1 sentence)
      2. Emotional Insight (2–3 sentences, observational tone)
      3. Reflection Paragraph (3–5 sentences, introspective, second-person voice)
        ↓
[Entry Logger]
  - Persist entry to PostgreSQL
  - Store media reference (S3 key, NOT the raw media in DB)
  - Index for time-series analytics queries
```

### 5.3 Database Schema

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  tier VARCHAR(20) DEFAULT 'free', -- 'free' | 'premium' | 'enterprise'
  timezone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

-- Mood Entries
CREATE TABLE mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  media_type VARCHAR(10), -- 'image' | 'video'
  media_s3_key TEXT, -- encrypted reference to S3 object
  primary_mood_tag VARCHAR(50),
  secondary_mood_tag VARCHAR(50),
  mood_score INTEGER, -- 0–100 composite wellness score
  energy_score INTEGER, -- 0–100
  stress_score INTEGER, -- 0–100
  mood_summary TEXT,
  emotional_insight TEXT,
  reflection_paragraph TEXT,
  facial_analysis JSONB, -- raw module output
  voice_analysis JSONB, -- raw module output (null for images)
  eye_analysis JSONB,
  user_feedback VARCHAR(10), -- 'accurate' | 'inaccurate' | null
  is_shared BOOLEAN DEFAULT FALSE,
  share_token VARCHAR(64) -- for public share links
);

-- Streaks & Gamification
CREATE TABLE user_streaks (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_entry_date DATE
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  stripe_subscription_id VARCHAR(100),
  plan VARCHAR(30), -- 'premium_monthly' | 'premium_annual' | 'enterprise'
  status VARCHAR(20), -- 'active' | 'canceled' | 'past_due'
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enterprise Teams (Phase 3)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100),
  admin_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'member',
  PRIMARY KEY (team_id, user_id)
);
```

---

## 6. Feature Requirements

### 6.1 MVP Features (Phase 1)

#### F1 — Onboarding
- Email/Google/Apple sign-up via OAuth2
- 3-step onboarding: name → timezone → notification preference
- Brief explainer animation showing how Echo works (Lottie or CSS animation)
- No credit card required for free tier

#### F2 — Mood Capture Flow
- **Entry Point:** Large central CTA button on home screen: "Check In"
- **Input Options (presented as 3 cards):**
  - 📸 Take Selfie (camera access via browser MediaDevices API)
  - 🎥 Record Clip (5–15 second enforced limit, countdown timer shown)
  - 📁 Upload File (image or video, max 50MB, accepted formats: jpg/png/mp4/mov/webm)
- **Processing State:** Full-screen animated processing screen ("Echo is reading you...") while async pipeline runs — estimated 8–15 seconds
- **Result Screen displays:**
  - Animated mood tag badge (primary + secondary)
  - Mood summary sentence
  - Emotional insight
  - Reflection paragraph
  - Mood score ring (0–100, animated fill)
  - Energy score indicator
  - Thumbs up/down feedback button ("Was this accurate?")
  - Option to add a personal note (optional text, max 280 chars)
  - Share button (generates aesthetic card image for social)

#### F3 — Entry Log / History Feed
- Reverse chronological list of all past entries
- Each entry card shows: date, primary mood tag, mood score ring, thumbnail (blurred for privacy by default), 1-sentence summary
- Tap to expand full reflection
- Filter by mood tag, date range
- Free tier: last 7 days of entries visible; Premium: full history

#### F4 — Mood Dashboard (Analytics)
- **Free Tier:** Weekly mood bar chart (current week only), current streak counter
- **Premium Tier:**
  - 30/90/365-day mood trend line chart
  - Energy cycle heatmap (calendar view, color-coded by energy score)
  - Stress spike timeline with annotations
  - Mood tag distribution pie/donut chart
  - Top 3 recurring moods over selected period
  - Streak counter + longest streak badge

#### F5 — User Settings
- Profile: edit display name, avatar, timezone
- Notifications: daily check-in reminder (push/email), weekly summary email
- Privacy: toggle media deletion after analysis (auto-delete video/photo post-processing), data export (JSON), account deletion
- Subscription management: upgrade/downgrade, billing portal (Stripe Customer Portal)

#### F6 — Freemium Gate
- Free tier limits:
  - 1 entry per day
  - 7-day history
  - Basic mood tag only (no secondary tag)
  - No trend analytics
- Upgrade prompt shown contextually (e.g., when user tries to view older history, or accesses analytics)
- Paywall screen: feature comparison list + CTA

### 6.2 Premium Features (Phase 1 — Paywalled)

- Unlimited daily entries
- Full entry history
- Full analytics dashboard
- Secondary mood tag
- AI Advice Mode: after reflection, GPT generates 1 actionable suggestion based on current mood
- Downloadable PDF mood reports (monthly)
- Custom notification schedules

### 6.3 Phase 2 Features

#### Drift Detection
- Background job runs weekly per user
- Analyzes 14-day rolling mood score average
- If average declines >15 points over 2 consecutive weeks → trigger "Drift Alert" in-app notification
- Alert message: gentle, non-clinical language ("Your energy has been lower lately — Echo noticed.")

#### Burnout Warning System
- Stress score averaging >70 for 5+ consecutive days → "Burnout Risk" banner on dashboard
- Recommend: breathing exercise link, reduce entry frequency prompt, optional therapist directory CTA (affiliate)

#### Emotional Forecasting
- After 30+ entries, train a lightweight per-user LSTM or use GPT with historical context
- Predict tomorrow's likely mood range based on historical patterns (day of week, streak length, recent trend)
- Displayed as: "Tomorrow's Forecast: Likely moderate stress — you tend to feel this way on Wednesdays"

#### Emotional Replay
- Side-by-side comparison: today's entry thumbnail vs. entry from 1 month / 3 months / 6 months ago
- Show mood score delta, energy score delta, mood tag change
- Option to share as a "Growth Card" image

#### Creator Mode
- Shareable aesthetic mood timeline (last 7 days, Instagram-story format)
- AI-generated monthly "Your Month in Emotions" video recap (stitched keyframes + mood tag overlays + background music)
- Custom AI reflection voices (calm, energetic, therapist-style) — Premium Add-on

### 6.4 Phase 3 Features — Enterprise

- Team admin creates anonymous workspace
- Team members connect personal Echo account (data anonymized before team aggregation)
- Admin dashboard shows:
  - Team mood heatmap (no individual data exposed, minimum 5 members to show data)
  - Weekly team energy trend
  - Burnout risk flag (shown as "% of team showing elevated stress indicators")
  - Export to CSV for HR reporting
- Pricing: per-seat monthly SaaS ($8–15/seat/month)

---

## 7. AI Prompt Engineering Specifications

The GPT reflection generator must receive a structured system prompt and dynamic user context. Below is the required prompt architecture:

### System Prompt (Static)
```text
You are Echo, an empathetic AI emotional intelligence companion. Your role is to translate a user's detected emotional signals into a warm, honest, and grounding reflection. You do not diagnose. You do not give medical advice. You speak in second person ("you"). Your tone is calm, observant, and supportive — like a wise friend who truly sees you. Keep all outputs concise. Never be performatively positive or toxic. Be honest about what you detect.
```

### Dynamic User Prompt (Injected per Entry)
```text
Today's date: {date}, {day_of_week}
User's local time: {local_time} ({morning/afternoon/evening/night})
Entry type: {image | video}
Detected emotional signals:
- Primary facial expression: {expression} (confidence: {score}%)
- Micro-expression detected: {yes/no} — {type if yes}
- Eye contact stability: {stable/avoidant/fatigued}
- Blink rate: {normal/elevated/low}
- Voice tone: {if video: warm/flat/tense/elevated | N/A}
- Speech speed: {if video: slow/normal/fast | N/A}
- Energy level: {0–100}
- Stress score: {0–100}
- Composite mood score: {0–100}

Generate the following (in JSON format):
1. "mood_summary": One sentence. What is the user's current emotional state?
2. "emotional_insight": 2–3 sentences. What do the signals suggest about what the user may be experiencing internally?
3. "reflection_paragraph": 3–5 sentences. A grounded, second-person reflection helping the user understand and sit with their current state.
4. "primary_mood_tag": Single tag from approved vocabulary.
5. "secondary_mood_tag": Single tag from approved vocabulary (can be same as primary if no nuance).

Approved mood tag vocabulary: calm, stressed, driven, low energy, optimistic, anxious, focused, disconnected, energized, melancholic, content, overwhelmed, excited, uncertain, grateful, tense, reflective, motivated, drained, hopeful
```

---

## 8. UI/UX Requirements

### Design Language
- **Aesthetic:** Minimal, dark-mode first, soft gradients, glassmorphism elements
- **Color Palette:**
  - Background: `#0A0A0F` (near black)
  - Surface: `#13131A` (dark card)
  - Primary Accent: `#7B61FF` (violet-purple)
  - Secondary Accent: `#00D4AA` (teal-green)
  - Text Primary: `#F0F0F5`
  - Text Secondary: `#8B8B9E`
  - Mood tag colors: each tag has a unique soft color (e.g., calm = blue, stressed = red-orange, optimistic = golden yellow)
- **Typography:** Inter or DM Sans (clean, modern, readable)
- **Motion:** Framer Motion for page transitions, mood ring fill animations, and processing screen particle effects
- **Icons:** Lucide React or Phosphor Icons

### Key Screens
1. **Splash / Auth Screen** — Logo + tagline + "Get Started" + "Log In"
2. **Home / Dashboard** — Mood score ring (today), streak badge, "Check In" CTA, mini chart (last 7 days), recent entries row
3. **Check-In Screen** — 3 input method cards, camera/upload interface
4. **Processing Screen** — Full screen, animated waveform or particle effect, subtle progress indicator
5. **Result Screen** — Mood badge (animated), mood score, summary, insight, reflection, feedback buttons, share CTA
6. **History / Log Screen** — Filtered scrollable list of entry cards
7. **Analytics Dashboard** — Tabbed view (Week / Month / Year), charts, insights callouts
8. **Settings Screen** — Profile, privacy, notifications, subscription
9. **Paywall / Upgrade Screen** — Feature comparison, pricing toggle (monthly/annual), Stripe checkout embed
10. **Onboarding Flow** — 3-step cards with progress dots

### Accessibility Requirements
- WCAG 2.1 AA compliance
- All interactive elements keyboard navigable
- ARIA labels on all media controls and icon buttons
- Minimum contrast ratio 4.5:1 for all text
- Support for reduced motion preference (disable non-essential animations)

---

## 9. API Integrations

| Service | Purpose | Priority |
|---|---|---|
| Hume AI | Facial + voice emotion analysis | Primary AI Engine |
| AWS Rekognition | Fallback facial expression detection | Secondary |
| MediaPipe (Google) | Eye movement + face mesh tracking | Open-source module |
| AssemblyAI or Whisper | Audio transcription + speech speed | Voice analysis |
| OpenAI GPT-4o | Reflection generation | Core |
| Stripe | Payments, subscriptions, billing portal | Monetization |
| Auth0 or Supabase Auth | Authentication | Auth |
| AWS S3 / Cloudflare R2 | Encrypted media storage | Storage |
| SendGrid or Resend | Transactional emails + weekly summaries | Email |
| PostHog or Mixpanel | Product analytics + funnel tracking | Analytics |

---

## 10. Security & Privacy Requirements

These are non-negotiable. Privacy is Echo's core trust mechanism.

- **Media Encryption:** All uploaded media encrypted at rest (AES-256) and in transit (TLS 1.3)
- **Post-Processing Deletion:** Default setting — media is deleted from server within 1 hour of analysis completion. Raw video/photos are NEVER stored long-term unless user explicitly opts in.
- **No Third-Party Data Sharing:** AI analysis API calls must use anonymized payloads — no user PII sent to external APIs
- **Data Stored:** Only the extracted signals (JSON) and generated text are persisted, NOT the raw media (unless opt-in)
- **GDPR Compliance:** Right to access, right to erasure, data portability (JSON export), consent management
- **CCPA Compliance:** California privacy policy, opt-out of data sale (none planned, but required disclosure)
- **Zero-Knowledge Option (Phase 2):** User-controlled encryption key option for ultra-privacy mode
- **SOC 2 Type II (Phase 3 — Enterprise):** Required before enterprise contracts
- **Privacy Policy Requirements:** Plain-language explanation of exactly what is analyzed, what is stored, and for how long — shown during onboarding before first check-in

---

## 11. Monetization Implementation

### Stripe Integration Requirements
- Products to create in Stripe:
  - `echo_premium_monthly` — $9.99/month
  - `echo_premium_annual` — $79.99/year (~$6.67/month, save 33%)
  - `echo_enterprise_seat` — $12/seat/month (Phase 3)
- Implement Stripe Checkout for upgrade flow
- Implement Stripe Customer Portal for subscription management
- Webhook handlers required for: `customer.subscription.created`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
- Entitlement check middleware: every premium API route checks `users.tier` field before serving

### Free Tier Enforcement
- Entry count per day tracked in Redis with TTL reset at midnight (user's timezone)
- History query endpoint applies `LIMIT` based on tier
- Analytics endpoint returns 403 with upgrade prompt JSON for free users

---

## 12. Notification System

- **Daily Check-In Reminder:** Push notification (web push + mobile) at user-configured time (default: 8:00 AM local time)
- **Streak At-Risk Alert:** If user hasn't checked in by 9:00 PM and has a streak ≥ 3 days → "Don't break your streak — 3 hours left"
- **Weekly Summary Email:** Every Sunday, email with: top mood of the week, avg. mood score, streak, one reflection quote from the week's entries
- **Drift/Burnout Alert:** In-app banner + email (Phase 2)
- **Milestone Notifications:** 7-day streak, 30-day streak, first 100 entries, etc.

---

## 13. Development Phases & Roadmap

### Phase 1 — MVP (Target: 10–12 weeks)
- [ ] Auth + onboarding flow
- [ ] Media capture (selfie, video record, upload)
- [ ] AI pipeline: Hume AI integration + GPT-4o reflection
- [ ] Entry logging + result screen
- [ ] Basic history feed (last 7 days free)
- [ ] Weekly mood chart (free tier)
- [ ] Stripe subscriptions (monthly + annual)
- [ ] Premium analytics dashboard
- [ ] Settings + privacy controls (media auto-delete)
- [ ] PWA manifest + offline capability
- [ ] Email notifications (SendGrid)

### Phase 2 — Growth (Target: Weeks 13–24)
- [ ] Native iOS + Android apps (React Native)
- [ ] Drift Detection system
- [ ] Burnout Warning alerts
- [ ] Emotional Forecasting engine
- [ ] Emotional Replay feature
- [ ] Creator Mode (shareable mood cards + monthly recap video)
- [ ] Custom reflection voices
- [ ] Therapist directory integration (affiliate)
- [ ] Referral system

### Phase 3 — Scale (Target: Month 7+)
- [ ] Enterprise admin portal
- [ ] Team anonymous heatmap
- [ ] SSO / SAML for enterprise
- [ ] SOC 2 audit
- [ ] API access for enterprise customers
- [ ] White-label option

---

## 14. Non-Functional Requirements

- **Performance:** AI pipeline must complete within 15 seconds for 95th percentile of entries; result screen must render within 1 second of pipeline completion
- **Uptime:** 99.9% SLA target
- **Scalability:** Architecture must support horizontal scaling — AI pipeline as stateless microservice, queue-backed processing
- **Cold Start Mitigation:** Keep AI processing service warm with scheduled pings
- **Error Handling:** If AI pipeline fails, return graceful fallback entry with manual mood tag selector rather than a blank error screen
- **Rate Limiting:** 10 req/min per IP on auth endpoints; entry submission rate-limited by tier enforcement

---

## 15. Out of Scope (MVP)

- Clinical or diagnostic features of any kind
- Real-time therapist connection
- Group / social feed
- Mood-based music playlist generation *(Phase 2+)*
- Relationship compatibility tracking *(Phase 3+)*
- Mirror Mode facial tension visualizer *(Phase 3+)*

---

## 16. Open Questions for Builder to Resolve

1. **Primary AI Vision Provider:** Hume AI is the recommended first choice for its combined facial + voice emotional analysis. Confirm API pricing is within budget before committing.
2. **Media Retention Policy UI:** Confirm whether "auto-delete after analysis" should be default-on or opt-in — recommend default-on to build user trust.
3. **Reflection Voice Tone:** Should the default GPT tone skew more poetic or more clinical/neutral? Define this before writing final system prompt.
4. **Video Size Limit:** 50MB is recommended for MVP. Consider if lower (25MB) is more cost-efficient for S3 at scale.
5. **Minimum Entry Count for Forecasting:** Confirm 30 entries as the threshold before Emotional Forecasting unlocks — adjust based on model accuracy testing.
