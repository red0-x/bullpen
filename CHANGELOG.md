# Changelog

## 2026-10-25 — Photo-first fixing, SF contractor directory, voice agent
### Added
- "Something broke" is now photo-first. The screen has one big "Take a picture" button that opens the live camera, with "Upload a photo" and "Describe it instead" as backups. After the snap, everything fills itself in: what's wrong, how to fix it, the trade, the property, the amenity and the urgency. If the AI can't tell which property, it uses the one you used last, otherwise your first one. A small "Wrong? Change" link lets you fix it if needed.
- A San Francisco contractor directory for the detected trade: 4 businesses per trade, ranked in code by reviews (weighted toward ones with more reviews), distance (your location if allowed, otherwise central San Francisco), reply speed and licensing. Each card opens up to show photos, 6 stats, reviews, Call, Text them, Map and Save to bench (with Undo). These are clearly labelled **sample listings (made-up businesses)**.
- "Track this & see my bench" saves the issue and opens the issue page, asking "Add to it?" if there's already an open issue for that spot.
- Voice agent: a "Talk to Bullpup" puppy button on every app screen. It listens through the browser's speech recognition, answers out loud, and can take you to the camera, Fix-it list, Bench, Properties or a specific issue. Typing works too, and there's a friendly message if the AI call fails.
### Fixed
- Uploading a photo before the page finished loading showed an error. The page now waits for your properties to load first.
- When the AI isn't sure about a photo, it now says so instead of leaving "What's wrong" blank.
- Unlicensed businesses can no longer outrank licensed ones as "Best match".

## 2026-10-25 — Fix: stuck on "Looks right, find help"
### Fixed
- When the AI couldn't tell which property a photo was from, the confirm button stayed greyed out with no explanation. A "Where is it?" box now shows the matching spots at each property (for example Plumbing at Tahoe, Joshua Tree and Oakland). One tap picks the property and amenity together. "Show every amenity" reveals the rest, and a hint says what's still missing.
- The AI no longer guesses a property unless the photo or note points to one.
- Long amenity names (for example "Kitchen appliances") no longer get cut off in the picker.

## 2026-10-25 — Camera finished + Layers 2, 4, 5, 6
### Added
- Live camera: "Snap a photo" opens a real viewfinder on phones and computers (webcam), with a shutter, a switch-camera button and a retake. If the camera is blocked or missing, the phone's own camera or the upload picker opens instead.
- The photo diagnosis now looks for cracks, leaks, stains, rust, mold, error lights and so on. It also returns "How to fix it": 2 to 5 steps, a safety warning when there's risk, and "DIY or call a pro". Personal items (for example earbuds) get a note that there's no contractor to call. The guidance is saved with the issue and shown on the issue screen.
- Import contacts: paste anything, the AI pulls out each contractor and you check a preview table before saving.
  - Fields the AI is unsure about are highlighted with "Pick a trade".
  - Duplicates ask "Looks like X is already on your bench. Merge or keep both?"
  - An empty result says "We couldn't find any contractors in that. Try pasting names and phone numbers."
  - If the AI fails it says "Couldn't read that right now." and offers the manual form.
  - Saved contractors are matched to property and amenity slots by trade and service area. Undo is available.
- "+ Add contractor" form, always available, with Undo.
- Ranked bench per property and amenity: score, one-line reason, pin and unpin, and a status change (active, unreachable, out of business), each with Undo.
- "How did it go?" on scheduled issues: showed up, on time, a 1 to 5 rating and a note. Each one is saved as a new job record.
  - The bench re-ranks right away and shows what moved ("X moved from #1 to #2: No-show on Oct 24").
  - A no-show reopens the issue and opens the next backup.
  - Undo works for 1 minute. Outcomes can be edited later; an edit adds a new version and keeps the old one.
  - "Last contacted" is updated for everyone involved.
- Fix-it list as home, in order: open issues waiting on a contractor, outcomes not logged, coverage gaps (0 or 1 active contractor), stale contacts (90+ days with Still active, Out of business and Snooze 30 days), then bench watch alerts. When nothing needs you, the sleeping puppy says "Your bench is ready. Nothing needs you today."
- Bench watch with sample signals (reply time, public rating, business open, phone working, license), clearly labelled as sample data.
  - Signals adjust scores with a reason ("Rating dropped from 4.7 to 3.9 this month").
  - Flags such as a disconnected phone or "permanently closed" mark the contractor unreachable.
  - "Check now" reruns the checks on the sample signals and shows what changed.
- Amenity tiles on Properties link to their slot on the bench.
### Changed
- Service-area matching now accepts partial city names ("Tahoe" matches "South Lake Tahoe").
- Open demo issues now show on the Fix-it list too.

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
