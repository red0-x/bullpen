# Bullpup — Plan

Bullpup keeps a ranked backup bench of contractors for every property and amenity a short-term rental host manages.
When something breaks, the host snaps a photo, Bullpup figures out what's wrong and who can fix it, and shows the top 3 people to call.

## Who it's for
Self-managing Airbnb and Vrbo hosts with 1 to 5 properties who handle repairs themselves and need a reliable backup when a contractor goes quiet right before guests arrive.

## Core features and experience
- **Host accounts**: open sign-up and login with email and password. Each host sees only their own properties, contractors, issues and history.
- **Full data model from day one**: hosts, properties, amenities, contractors, issues, requests, job outcomes and watch signals are all real saved records that survive a page refresh. Job outcomes are always added as new records and never overwrite old ones.
- **Demo data**: a "Load demo data" button fills the account with made-up sample data: 3 properties (Tahoe Cabin, Joshua Tree A-Frame, Oakland Duplex), their amenities, 18 contractors across all trades and 8 weeks of job history. It includes three planted problems: the Tahoe hot tub has only 1 contractor, one contractor has recent no-shows, and Dave's Pools hasn't been contacted since July. Loading it twice never creates duplicates. A "Reset demo data" button (with a confirm step) clears it and loads it again from scratch.
- **Properties screen**: each property is a card with its amenities shown as small tiles. A tile with no contractors gets a blush "No contractors" badge.
- **Scoring, done in code and never by the AI**: show-up rate 40%, on-time rate 20%, host rating 25%, response speed 15%. Jobs from the last 90 days count double. New contractors start at 60 with the label "New, no history yet." Unreachable and out-of-business contractors are greyed out and never ranked. Pinned contractors come first. Ties go to whoever had the most recent successful job. Every score shows a one-line reason.
- **AI drafts, the host decides**: GPT reads photos and pasted contacts and drafts messages. Nothing is saved or sent until the host approves it, and nothing is ever sent automatically. Every AI call has a time limit, a friendly error message and a manual way to do the same thing.
- **Safety nets**: every list has a designed empty state, and every action that changes data has an undo or a confirm step.
- **CHANGELOG.md** is updated with features and fixes after every turn.

## What the server handles
- Login, sign-up and keeping each host's data separate from everyone else's.
- Storing every record listed above, with timestamps.
- The demo seed and reset, run safely for the logged-in host only.
- The score and ranking math, recalculated whenever an outcome is logged or a signal changes.
- Phase 2 onward: calls to GPT for photo diagnosis, contact extraction and message drafts. Each call has a timeout and falls back to a manual form or a simple message template.
- Phase 2 onward: storing issue photos so they reload with the issue.

## User flow
1. Sign up or log in.
2. On first visit, tap "Load demo data" (or start empty).
3. Browse properties and amenities and spot the gaps flagged with "No contractors."
4. Later phases: paste in contacts, review the ranked bench, tap "Something broke," confirm the AI's diagnosis, request one of the top 3 contractors, then log how the job went so the scores update.

## UI/UX feel
- Flat, friendly and illustration-led, like Duolingo. No drop shadows, blur, gradients, glassmorphism, neumorphism or claymorphism.
- Cream background #FBF4EA. White cards with a 1.5px #E8D9C6 border and 20px corners.
- Primary buttons are cap brown #7B3F25 with white text and a solid 4px #5A2C18 lip that disappears when pressed. Secondary buttons are white with a #E8D9C6 border and lip and brown text. Only primary buttons use the brown.
- Text is espresso #3A1F14, with #7A5A48 for secondary text. Badges are fully round flat tints: blush for warnings, sage for "Ready."
- Corners are 16px on buttons and 8px on inputs and chips.
- Bricolage Grotesque ExtraBold for the wordmark and headings, Onest for everything else.
- Text contrast is at least 4.5:1, tap targets are at least 44px, and everything works on a 390px phone screen.
- Every screen has a header with the puppy, the "Bullpup" wordmark, nav (Bench, Properties, Fix-it list) and a "Something broke" primary button. Screens not built yet show a friendly empty state.
- **Mascot**: the three uploaded poses are used as provided: the head in the header, the glove pose for empty states and the sleeping pose for "nothing needs you." As you asked, extra poses (for example fixing a pipe or holding a phone) are created in the same flat style, colours and cap so they look like the same puppy.

## Implementation phases
**Phase 1 — MVP (built now, Layer 1)**
Sign-up and login, the full data model, demo data load and reset, the Properties screen with amenity tiles and "No contractors" badges, the header and the full look. Scoring logic is in place so the demo data ranks correctly. Bench and Fix-it list show placeholder empty states.

**Phase 2 — Bench and Something broke (Layers 2 to 4)**
Contact import with a preview table, "Pick a trade" for uncertain fields, merge-or-keep for duplicates, and a manual "+ Add contractor" form. The ranked bench with pinning. The photo-first "Something broke" flow with the GPT diagnosis, the top 3 contractors, request drafts with Copy text or Open in Messages, and the No answer, Declined and Booked responses. Then "How did it go?" outcomes with a 1-minute undo, editable outcomes, a live re-rank with explanations, and a no-show reopening the issue.

**Phase 3 — Health, watch and paid access (Layers 5 to 6 and stretch goals)**
Coverage gaps, stale contacts and the Fix-it list as the home screen with its sleeping-puppy empty state. Bench watch with sample signals, clearly labelled as demo data, and a "Check now" button. Paid access with a free trial. Stretch goals: maintenance schedules with "Book it" and email requests through Resend.

## Assumptions
- Sign-up is open to anyone for now. Your note about paid access with 1 to 2 free trials conflicts with the original "no real payments" rule, so paywall and trial limits move to Phase 3. That's when you'll pick the payment provider and decide whether a "trial" means a number of free fixes or a number of free days.
- You asked for new puppy poses, which replaces the original "never redraw him" rule. The original artwork itself is never altered.
- The AI is GPT, running on the Emergent key, with the recommended GPT vision model.
- Demo data belongs to each host's own account, and resetting it only affects that host.
- Reset deletes only demo records. If the host has added their own contractors, the confirm message warns about this first.
- Contractor phone numbers and emails are made up (for example 555 numbers and example.com addresses).
- "Open in Messages" opens the phone's own texting app with the draft filled in. Bullpup never sends texts itself.
- Password reset links are logged on the server for now instead of being emailed, until email is added in Phase 3.
- Dates and times use the host's own device time zone.
