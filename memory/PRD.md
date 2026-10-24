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
- 2026-10-24 — Layer 1: auth, full data model, demo load (idempotent, undo) / reset (confirm), Properties screen with amenity tiles + coverage badges, header + design system, placeholders for Bench / Fix-it / Something broke. Tested (iteration_1), lockout fix applied after.

## Backlog
- P0: Layer 2 (import contacts with AI + manual add, ranked bench, pinning)
- P0: Layer 3 (Something broke photo flow, top 3, request drafts)
- P1: Layer 4 (outcomes, re-rank, undo), Layer 5 (coverage gaps, stale, Fix-it home)
- P2: Layer 6 (Bench watch), maintenance schedules, Resend email, paid access/trial

## Next tasks
Layer 2.
