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

## 2026-06: Four follow-up features
- **Live address search:**
  - GET /api/onboarding/autocomplete returns suggestions as you type. It uses Google Places API (New), which is ON for the key, with a session token. If Google is off, it falls back to OpenStreetMap Photon.
  - POST /api/onboarding/place turns a Google pick into the address and coordinates.
  - /onboarding/geocode also falls back to Photon while Geocoding API is off. Denied Google APIs are cached for 5 minutes.
  - Frontend: src/onboarding/AddressSearch.tsx (debounced, ignores stale responses, shows "Powered by Google" or "© OpenStreetMap contributors").
- **Pin address later:** Rentals shows "Pin on map" for rentals with geocode.verified=false. It opens /onboarding?pid=X&pin=1, and the live suggestions run on the saved address.
- **Several rentals:**
  - /onboarding, /rooms and /review take ?pid=. GET /onboarding?property_id= works for any rental the host owns, including demo ones.
  - POST /onboarding/property accepts {property_id} (update) or {new:true} (another rental); POST /onboarding/rooms accepts property_id.
  - Rentals has an "Add a rental" button (/onboarding?new=1), and each card shows rooms and items with Pin and Rooms buttons. /properties returns rooms_count and items_count.
  - Demo cleanup also removes rooms and items on demo rentals.
- **Appliance-aware fixes:**
  - Diagnose sends the tagged items to the AI, which returns item_id; it is checked against the chosen rental.
  - Snap guesses the item from the AI, or from synonym name matching, and the host confirms or changes it ("Is it this one?").
  - The issue stores item_id, and GET /issues/{id} returns the item with its room. Drafted contractor messages and the SMS template include brand, model and room. GET /api/inventory lists the items.

## 2026-06: Last-used rental + test fixes (iterations 8–10)
- Backend tests: test_iter7_features.py now follows the real flow (the host skips first setup, then adds rentals). Run with `-n 0`: 73/73 pass. Finishing an extra rental doesn't mark first setup done.
- Snap and Bench remember the rental the host last used (src/lastRental.ts, storage key last_property).
  - Snap saves it on a property chip pick and on Track.
  - Bench shows rental chips plus "All rentals" when the host has 2 or more. It opens on the last-used rental, else the first.
  - Bench ?focus= (from a Rentals amenity tile) switches to the owning rental once, then the param is cleared.
- Polish: the no-photo diagnose message, an empty-amenities card on Bench, the address shown when a rental has no city, and chips that expose their selected state.
- AR room scan (RoomPlan / munim-xr) can only be checked in a native build, not in Expo Go or the web preview.

## 2026-06: Cover photos, service reminders, job costs, appliance history (iterations 11–12)
- **Rental cover photos:**
  - PUT /api/properties/{id}/cover takes {photo: /api/files/url or null}; the file must belong to the host.
  - The Rentals card shows a banner (src/components/RentalArt.tsx). Rentals without a photo get a Bullpen house drawing in their own colour, picked by position (the server sends `palette`, using the stable RENTAL_ORDER).
  - The "Add photo / Change" sheet offers camera, library and back-to-drawing (src/components/CoverSheet.tsx).
  - Bench and Snap rental chips show a round avatar.
- **Service reminders** (item.service = {interval_months 3|6|12, next_due, last_done, email, emailed_for}):
  - PUT/DELETE /api/items/{id}/service; POST /items/{id}/service/done {done_on, cost, contractor_id, note}; DELETE /api/service-logs/{id} (newest manual log only).
  - POST /items/{id}/service/book creates an issue with kind='service', with the trade guessed from the item name.
  - Fix-it gets a kind='service' card 30 days before the due date or when overdue, with Mark done / Book a pro / History. The card is hidden while a service job is open.
  - Email: Emergent managed email (emailer.py, EMAIL_FROM_NAME=Bullpen). One email per host, 7 days before each due date.
    - An hourly loop (maintenance_routes.start_reminders) plus a check right after saving a reminder; the claim is atomic.
    - Reserved domains such as example.com are skipped. Transient failures are retried; billing refusals are not.
- **Job costs:** the outcome form has a cost field when "Showed up" is yes (JobOutcome.cost). A service job's showed-up outcome logs the service and moves next_due on; undoing it or changing it to a no-show reverts that.
- **Appliance history:**
  - GET /api/items/{id}/history returns repairs (status, contractor, rating, cost), services, total_cost and jobs.
  - Screens: /appliance/[id] (stats, service card, timeline) and /appliances?pid= (a rental's appliances by room).
  - Entry points: the Rentals "Appliances" button, the ItemSheet "Service reminders & history" button, the issue screen's appliance row, and the Fix-it History button.
- **Maps:** the Google Geocoding API and Maps Static API are still not enabled on the user's key. The code uses them automatically once they are turned on (within 5 minutes).
