# 47 Cities — Kenya's Futuristic Proximity Social & Companionship Hub

A responsive **Mobile + PC** web-based social media and companionship platform for Kenyan city singles (**20–50 years old**) blending **Facebook**, **X / Twitter**, and **Instagram** UX with behind-the-hood **AI automation**, **10 km privacy-preserving proximity**, **strict email-only authentication**, **3-window simultaneous multimedia chat**, and a **public Blackboard**.

## Key Features

- **Email-Only Registration & 18+ Signed Privacy Disclaimer**: Email + password + 6-digit email verification code (built-in Dev Verification Inbox for local testing + optional SMTP via `.env`) and mandatory 18+ signed responsibility disclaimer.
- **Mandatory 10 km Location Gate & Privacy Shield**: Portal stays completely locked when Location is OFF. Active members connect within a **10 km radius** filtered strictly by their `Interested In` preference (`Men`, `Women`, `Both`). Other members see **only** Profile Photo, Nickname, Gender, Age Range, Online status, and a `Within 10 km` badge — coordinates and private profile fields are never exposed.
- **Simultaneous Multi-Window Chat (Max 3 Side-by-Side)**: Up to 3 active chats side-by-side on PC (3-tab switcher on Mobile) with Emoji Picker, Voice Notes (`MediaRecorder` + inline audio player), and **20 MB / 2-hour ephemeral images** that automatically purge on logout/session end or after 2 hours.
- **Public Blackboard & Proximity Stories**: Post across `Politics`, `Health`, `Sports`, `Lifestyle`, and `Hangouts` with reader **Stars**, cumulative **10-view (`+1★`)** & **100-view (`+10★`)** milestones, reactions, threaded comments, reposts, bookmarks, and **AI Polish**.
- **Behind-the-Hood AI Automation**: Chat-algorithm interest mining over time, hidden-profile compatibility scoring, **"What's Next"** predictions, and Kenyan AI Icebreakers (runs locally out of the box; optionally enhanced via `GEMINI_API_KEY`).

## Quick Start (Local)

```bash
npm install
npm run dev      # Express API (:3001) + Vite (:5173)
```

Production build:
```bash
npm run build
npm start        # Serves built frontend + API on http://localhost:3001
```

Demo account: `demo@47cities.ke` / `Kenya2026!` (or register any new email and use the built-in **Dev Verification Inbox** modal).

## Quick Start (Docker)

```bash
docker pull pkmombasa/47-cities:latest
docker run -d --name 47-cities -p 3001:3001 pkmombasa/47-cities:latest
```

Or with Docker Compose (persistent SQLite & uploads volumes):
```bash
docker compose up -d
```

## Verification & Tests

```bash
npm run typecheck           # TypeScript strict check
npm test                    # 16 Vitest API, Privacy, Geo, Media & AI tests
node tests/e2e-browser.mjs  # Playwright Desktop (1440x900) & Mobile (390x844) E2E
```
