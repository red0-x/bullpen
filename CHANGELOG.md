# Changelog

## 2026-10-24 — Layer 3 + landing page
### Added
- Public landing page at `/` with scroll animations: parallax hero with a floating puppy and cards, a trades marquee, a sticky "the problem" story, a horizontal "how it works" track, animated score bars, an illustrated cabin scene and a call-to-action.
- New puppy poses (camera, sniff, phone, wrench, cheer) and a cabin illustration, made in the same flat style. The original three poses are unchanged. The puppy now bobs, sniffs, hops and wiggles when you hover, and his Z's float while he sleeps.
- "Something broke" flow: take or upload a photo (the phone camera opens), add an optional note and guest arrival time, or just type what broke. The AI drafts what's wrong, the trade, the urgency, the property and the amenity. You confirm it or change it with dropdowns and amenity tiles. If the AI can't tell or fails, you see a friendly message and pick it yourself. An existing open issue for the same amenity prompts "Add to it?".
- Issue screen: photo, diagnosis, top 3 active contractors with score, reason, phone and a Request button. It skips anyone unreachable or already asked for this issue. It shows a notice when there are only 1 or 2 backups, or none (with a link to add one), and a "See full bench" link.
- Requests: the AI drafts a message (a simple template is used if it fails). You edit it, then Copy text or Open in Messages. The request time is logged and the status becomes Waiting, with Undo. "No answer, try next" opens the draft for the next person. "Declined" moves on without counting as a no-show. "Booked" asks for a date and sets the issue to Scheduled. Every response has Undo.
- Fix-it list now lists your open, waiting and scheduled issues, with the sleeping puppy when nothing needs you.
### Changed
- The app home moved to `/fix-it/`. Login takes you there.
- Reset demo data also removes your issues on the demo properties.

## 2026-10-24 — Layer 1
### Added
- Next.js (App Router) + Tailwind frontend, FastAPI + MongoDB backend.
- Host sign-up, login and logout with email and password (httpOnly cookie sessions, lockout after 5 failed tries).
- Full data model: hosts, properties, amenities, contractors, issues, requests, job outcomes (never overwritten), watch signals. Every record belongs to one host.
- Scores calculated in code, each with a one-line reason. Pinned contractors come first. Unreachable and out-of-business contractors are never ranked.
- "Load demo data" (safe to rerun, with Undo) and "Reset demo data" (with a confirm step). Sample data has 3 properties, 15 amenities, 18 made-up contractors and 8 weeks of job history.
- Properties screen with amenity tiles and coverage badges.
- Header on every screen.
### Fixed
- Login lockout now works behind the proxy. The demo host account is created on startup. Expired sessions refresh automatically.
