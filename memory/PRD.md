# Bullpup — PRD

## Original problem statement
Build a web app called Bullpup for short-term rental hosts (Airbnb, Vrbo) who manage 1 to 5 properties themselves. Keeps a ranked backup bench of contractors for every property and amenity. When something breaks, the host snaps a photo, Bullpup works out what's wrong and who can fix it, and shows the top 3 people to call, with one tap to request them. Every outcome updates the scores. Core rules: real persisted data, scores in code with one-line reasons, AI only drafts (host approves, nothing auto-sent), made-up sample data only, every AI call has timeout + friendly error + manual fallback, designed empty states, undo/confirm on data changes, CHANGELOG.md each turn. Built in layers 1–6 (+ stretch). Full spec: data model, score (show-up 40 / on-time 20 / rating 25 / speed 15, 90-day double weight, new = 60, unreachable never ranked, pinned first, tie = most recent success), flat Duolingo-like look (cream #FBF4EA, white cards 1.5px #E8D9C6 20px corners, cap-brown primary buttons with 4px solid lip, Bricolage Grotesque ExtraBold + Onest, 44px tap targets, 390px). User later required stack: Next.js + Tailwind + MongoDB.

## Architecture
- Frontend: Next.js 15 App Router (static export config, `src/app`), Tailwind, sonner, lucide. Runs `next dev` on :3000.
- Backend: FastAPI (/api) + MongoDB (motor). Files: server.py (models, auth, endpoints), scoring.py, seed.py.
- Auth: email/password, bcrypt, JWT httpOnly cookies, refresh + 401 interceptor, lockout via X-Forwarded-For.

## User personas
Self-managing STR hosts with 1–5 properties.

## Core requirements (static)
See original statement; layers 1–6.

## Implemented
- 2026-10-25 — Deepgram voice: /api/voice/speak (Aura-2 Thalia mp3) and /api/voice/transcribe (Nova-3), DEEPGRAM_API_KEY in backend env; browser fallback. Verified with curl + UI.
- 2026-10-25 — Photo-first snap flow (auto-fill trade/property/urgency, no picking), sample SF contractor directory with expandable reviews/metrics/photos/call (directory_routes.py, ranked in code), voice agent (browser speech in/out + /api/voice/ask LLM with app context and navigation actions). Tested iteration_4; fixes applied.
- 2026-10-25 — Camera finished (live getUserMedia viewfinder on phone + desktop, fallback to native capture/upload) and AI "how to fix it" guidance (steps, safety, DIY vs pro, personal-item notice). Layers 2 (import contacts w/ preview, duplicates, Pick a trade, manual add, ranked bench, pin/status w/ undo), 4 (outcomes as new records, revisions on edit, 60s undo, live re-rank messages, no-show reopens + next backup, last-contacted for all), 5 (Fix-it home: waiting issues, outcomes, gaps, stale w/ Still active/Out of business/Snooze, watch alerts; onboarding + sleeping empty state), 6 (bench watch sample signals, score adjustments, flags mark unreachable, scripted Check now). Backend split: bench_routes.py, outcome_routes.py. Tested iteration_3 (backend 47/47), follow-up fixes applied.
- 2026-10-24 — Layer 3 + landing: public scroll-animated landing at /, new puppy poses + cabin art (generated, same style; originals unchanged), animated Mascot component, Something broke photo/camera flow with GPT-5.4 vision diagnosis (40s timeout, manual fallback), issue page with top 3, request drafts (AI or template), Copy/Open in Messages, No answer/Declined/Booked with undo, Fix-it list of open issues. App home moved to /fix-it/. Tested (iteration_2), fixes applied after.
- 2026-10-24 — Layer 1: auth, full data model, demo load (idempotent, undo) / reset (confirm), Properties screen with amenity tiles + coverage badges, header + design system, placeholders for Bench / Fix-it / Something broke. Tested (iteration_1), lockout fix applied after.

## Backlog
- P1: Guest arrival / booking date pickers styled (currently native datetime inputs)
- P2: Maintenance schedule per amenity with "Book it", Resend email requests, paid access/trial, property & amenity editing UI

## Next tasks
UI polish pass; maintenance schedules.
