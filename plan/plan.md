# Bullpen on GitHub: one branch per feature, one Emergent session per branch

The existing Bullpup project at Emergent gets a private GitHub repository named **bullpen**, owned by the user's personal GitHub account.
After that, each new feature gets its own Emergent conversation and its own branch, and finished branches get merged back into `main` on GitHub.

## Who it's for
The Bullpup project owner and anyone they invite who wants to build several Bullpup features in parallel without sessions overwriting each other's work.

## Important limitation
An Emergent session can't open or change another session's code. This session can't reach into the older Bullpup project and push it to GitHub. The first push has to be done from **inside the Bullpup project's own chat** using Emergent's built-in "Save to GitHub" button. This plan gives the exact steps for that push and for every session after it.

## Core features and experience
- **Private repository "bullpen"** on the user's personal GitHub account. It holds the current Bullpup code on the `main` branch.
- **GitHub connected to Emergent** (one-time sign-in through Emergent's GitHub connector; this needs the Standard plan or higher).
- **One branch per feature**: every new Emergent conversation starts from the bullpen repo and pushes to its own branch, for example `feature-login` or `fix-scores`.
- **Merge on GitHub**: finished branches go back into `main` through pull requests on GitHub.com. Emergent has no built-in merge tool.
- **A short "how we work" guide** (README section) added to the repo, so everyone follows the same branch rules.

## User flow
1. **First push (in the old Bullpup project):** open the Bullpup chat → wait until the agent isn't working → click **Save** → **Save to GitHub** → connect GitHub if asked → **create new repository** "bullpen" set to **Private** → branch `main` → confirm.
2. **Check on GitHub:** open github.com/<your-username>/bullpen and confirm the code is there and the repo shows as Private.
3. **Start a feature session:** on the Emergent Home tab, pick the **bullpen** repository to import. This opens a new conversation with the latest code.
4. **Build the feature** in that conversation.
5. **Push to a feature branch:** Save → Save to GitHub → repository bullpen → **create a new branch** named after the feature (never push feature work straight to `main`).
6. **Merge:** on GitHub.com, open a pull request from the feature branch into `main`, review it, and merge.
7. **Next feature:** go back to step 3. Always import fresh from `main` so each new session has every merged feature.

## Branch rules (kept in the repo guide)
- `main` = stable, merged work only.
- One feature or fix = one branch = one Emergent conversation.
- Branch names are short, lowercase, and use hyphens: `feature-...` or `fix-...`.
- Merge finished branches soon. Two long-running branches that change the same files can conflict, and conflicts get resolved on GitHub.
- Push often during a session so no work is lost.
- To keep going on the same feature when a conversation gets too long, use **Fork** in that chat and keep pushing to the same branch.

## UI/UX feel
No new app screens. Everything happens through Emergent's Save to GitHub menu, the Home tab import, and GitHub.com.

## Implementation phases
- **Phase 1 (MVP, now):** Bullpup pushed to the private `bullpen` repo on `main`, plus the branch-rules guide written into the repo's README. Steps 1 and 2 are done by the user in the Bullpup chat. After that, the first feature session imports bullpen and adds the guide on a `docs-workflow` branch, which then gets merged.
- **Phase 2:** Protect the `main` branch on GitHub so changes only arrive through pull requests. Optionally invite collaborators.
- **Phase 3:** Add a pull request template and simple automatic checks (for example, "the app builds") that run on every branch before merging.

## Assumptions
- "Bullpup" is the existing Emergent project. The repository is named **bullpen**, as the user asked.
- The user's Emergent plan supports the GitHub connector (Standard or higher).
- `main` is the default branch and starts from Bullpup's current state.
- Merging and resolving conflicts happen on GitHub.com, not inside Emergent.
- No Bullpup features or code change as part of this setup. Only the workflow guide gets added.
