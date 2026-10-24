# Changelog

## 2026-10-24 — Layer 1
### Added
- Next.js (App Router) + Tailwind frontend, FastAPI + MongoDB backend.
- Host sign-up, login and logout with email and password (httpOnly cookie sessions, lockout after 5 failed tries).
- Full data model: hosts, properties, amenities, contractors, issues, requests, job outcomes (append-only), watch signals. Every record is scoped to its host.
- Scoring in code: show-up 40%, on-time 20%, rating 25%, response speed 15%; jobs in the last 90 days count double; new contractors start at 60 ("New, no history yet"); unreachable/out-of-business never ranked; pinned first; ties go to the most recent successful job; every score has a one-line reason.
- "Load demo data" (safe to rerun, with Undo) and "Reset demo data" (with confirm). Sample data: 3 properties, 15 amenities, 18 made-up contractors, 8 weeks of job history. Planted problems: Tahoe hot tub has 1 contractor, Bay Flow Plumbing has recent no-shows, Dave's Pools not contacted since July, East Bay Appliance unreachable, Oakland EV charger has no contractors.
- Properties screen with amenity tiles and coverage badges ("No contractors" in blush).
- Header on every screen (puppy, wordmark, Bench / Properties / Fix-it list nav, "Something broke" button). Bench, Fix-it list and Something broke show friendly "coming next" screens.
