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
- P2: More than one property through onboarding; link tagged items to maintenance tickets

## Test credentials
See /app/memory/test_credentials.md

## 2026-10-25 — UI polish pass
- Collapsing headers: the page title fades into the top bar on scroll, with a parallax title and a bottom edge that appears on scroll (src/components/Screen.tsx).
- Cards rise and fade into view as you scroll (Card in src/ui.tsx). Buttons got a gradient face, a lip, a spring press, haptics and an icon bubble. Chips scale down when pressed.
- Spacing is roomier (20px). Fix-it has count tiles. The active tab gets a pill. The welcome page has a parallax mascot and a scrolling trade marquee.
- Fixes: the issue screen now checks login, the toast clears on logout, Rentals counts gaps the same way as Fix-it, and the Properties page is renamed Rentals.

## 2026-06 — Property onboarding with AR room scan
- Gate: every account, including the demo, goes to /onboarding until setup is finished or skipped (users.onboarding_complete / onboarding_skipped). The server also returns 403 on app APIs until then.
- Step 1, address (/onboarding): Google Geocoding runs through the backend proxy (/api/onboarding/geocode). You choose from the results, see a static map preview (/api/onboarding/staticmap, server-side key), and can add a nickname. "Skip setup for now" is available here.
- Step 2, rooms (/onboarding/rooms): add one room or the basic 4 rooms in one tap, delete rooms, and "Skip rooms, scan later" (finishes with the address only).
- Room capture (/onboarding/room/[id]):
  - iOS on a LiDAR device uses RoomPlan (expo-roomplan) for a 3D scan; the JSON and USDZ files are uploaded and the detected appliances are suggested.
  - Android, and iPhones without LiDAR, use munim-xr AR tagging: aim the reticle, tap a quick-tag chip, and the anchor and a snapshot are saved.
  - Fallbacks: camera photos, uploads, or a walkthrough video (4 frames are extracted). AI suggestions come from the photo via /api/onboarding/suggest. Tap a photo to pin items on it.
  - Item sheet: add or edit items with name, type, brand, model and notes.
- Step 3, review (/onboarding/review): map, stats, every room's items (editable), then Finish, which shows a celebration and opens the app.
- Rentals tab: a setup card links back to continue setup or manage rooms later.
- Files and photos go to Emergent object storage (/api/upload, /api/files/...). On web, the token is passed as ?token= so images load.
- AR only works in a native build. Web and Expo Go show the photo fallback.

## 2026-06: Fix for the Expo Go report "can't set up property, camera won't turn on"
- The address step no longer dead-ends. If the Google lookup fails, "Save as typed" stores the property with geocode {verified:false}: no map pin, and Review shows a "No map pin yet" badge. The backend validates types: unverified must be exactly true, numbers can't be booleans, text fields are coerced.
- Camera: added an in-app live camera (expo-camera CameraView, src/onboarding/LiveCamera.tsx) for room photos. It works in Expo Go, native builds and on the web, takes several shots in a row, and handles permissions in-modal, with Settings when blocked.
- iOS modal timing: on iOS, the picker, camera and AR open after the closing modal's onDismiss; other platforms wait 250ms. This uses useAfterDismiss in useCameraGate.tsx, and Sheet now has an onDismiss prop. The Snap tab now waits 500ms after its permission sheet.
- Google: Geocoding API and Maps Static API are still off in the user's Google Cloud project.
