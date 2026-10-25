## How we work on Bullpen (branches + Emergent sessions)

### Rules
- `main` = stable, merged work only. Never push feature work straight to `main`.
- One feature or fix = one branch = one Emergent conversation.
- Branch names: short, lowercase, hyphens — `feature-...` or `fix-...` (e.g. `feature-login`, `fix-scores`).
- Push often during a session so no work is lost.
- Merge finished branches soon. Two long-running branches that touch the same files can conflict; resolve conflicts on GitHub.
- If a conversation gets too long, use **Fork** in that chat and keep pushing to the same branch.

### One-time setup (done once, inside the original Bullpup chat)
1. Open the Bullpup chat and wait until the agent isn't working.
2. Click **Save** → **Save to GitHub** → connect GitHub if asked.
3. Create a new repository named `bullpen`, set it to **Private**, branch `main`, confirm.
4. Check github.com/<your-username>/bullpen shows the code and says Private.

### Every new feature
1. Emergent **Home** tab → import the **bullpen** repository (always fresh from `main`).
2. Build the feature in that new conversation.
3. **Save** → **Save to GitHub** → repo `bullpen` → **create a new branch** named after the feature.
4. On GitHub.com: open a pull request from the branch into `main`, review, merge.
5. Next feature → start again at step 1.

### Later
- Protect `main` on GitHub so changes only arrive through pull requests (Settings → Branches).
- Invite collaborators (Settings → Collaborators).
- Add a pull request template and an automatic "app builds" check.
