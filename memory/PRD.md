# Bullpen Mobile (renamed from Bullpup) — PRD

## Original problem statement
"Check the GitHub repository Bullpen ... copy the website onto mobile." The source is the public repo red0-x/bullpen, branch `conflict_241026_1927`, which holds the Bullpup web app (Next.js + FastAPI + Mongo). User choices: same features with a phone-friendly layout, and the backend rebuilt here.

## What Bullpup is
A ranked backup bench of contractors for short-term rental hosts who manage 1–5 properties. Snap a photo of what broke → AI diagnosis and fix steps → top 3 contractors → one-tap drafted request. Every outcome updates the scores.

## Architecture
- Backend: copied verbatim from the repo (server.py, bench_routes, outcome_routes, directory_routes, scoring, seed, ai). The AI uses gpt-5.4 via the Emergent LLM key.
  - Mobile change: login, register and refresh return access_token and refresh_token in the JSON body. Mobile sends them as Bearer.
- Frontend: Expo Router app.
  - Screens: /welcome (landing) and /login.
  - Tabs: Fix-it, Snap, Bench, Rentals. iOS 26+ uses NativeTabs.
  - Stack screen: /issue/[id].
  - Theme copied from the website: cream, cap-brown buttons with a lip, Bricolage Grotesque + Onest fonts, puppy mascot art.

## Implemented (2026-10-25)
- Auth: login, register, logout and token refresh. Tokens are stored in the device keychain.
- Fix-it list: waiting issues, outcomes, coverage gaps, stale contacts and watch alerts, each with an action and undo.
- Snap: camera (with permission flow), photo upload or a typed description → AI diagnosis, fix guide, a "wrong? change" editor, the SF sample directory, and Track issue (with an "add to existing issue" prompt).
- Issue screen: top 3 candidates, an AI-drafted request sheet (Copy text or Open in Messages), the requests panel (No answer / Declined / Booked with a day and time picker), How did it go, outcome edits and rank changes.
- Bench: ranked slots, pin/status, add contractor, AI import from pasted text, and bench watch.
- Rentals: properties with amenity tiles, plus load and reset of demo data.

## Backlog
- P1: Voice assistant (Deepgram), which was not ported
- P1: Move issue photos from Mongo base64 to object storage
- P2: Property and amenity editing, maintenance schedules, real directory data per city

## Test credentials
See /app/memory/test_credentials.md

## 2026-10-25 — UI polish pass
- Collapsing headers: the page title fades into the top bar on scroll, with a parallax title and a bottom edge that appears on scroll (src/components/Screen.tsx).
- Cards rise and fade into view as you scroll (Card in src/ui.tsx). Buttons got a gradient face, a lip, a spring press, haptics and an icon bubble. Chips scale down when pressed.
- Spacing is roomier (20px). Fix-it has count tiles. The active tab gets a pill. The welcome page has a parallax mascot and a scrolling trade marquee.
- Fixes: the issue screen now checks login, the toast clears on logout, Rentals counts gaps the same way as Fix-it, and the Properties page is renamed Rentals.
