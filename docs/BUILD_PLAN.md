# Build plan

Narrative Radar is a private research desk. It discovers narrative candidates, scores them, suggests names, draws template art, and keeps an alert inbox. It does not deploy tokens, trade, or forecast prices.

## Phase 1 — Foundation

Done. Monorepo, Auth.js credentials for a single owner, Prisma schema and SQL migration, Docker Compose, desk shell, demo seed, settings and source pages.

## Phase 2 — Discovery

Done for the local pipeline. RSS/Atom and Hacker News adapters, dedupe, clustering, explainable scores, durable scan lock, and server-sent events. Demo mode runs the same pipeline on fixtures.

## Phase 3 — Branding

Name suggestions and collision states are in place. Each candidate now gets a persisted visual brief and three labeled template drawings: a 1024×1024 mascot with no lettering, a 1024×1024 logo, and a 1500×500 banner. The logo and banner include the full name and a single `$TICKER`. The character and prop follow the story, such as a robot with a task folder. OpenAI image jobs still stay failed-and-honest until `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, and `OPENAI_IMAGE_SIZE` are set. No image-provider comparison has been run. See `docs/IMAGE_EVALUATION.md`.

## Phase 4 — Alerts

Done for the in-app inbox, rules, quiet hours, cooldown, hysteresis, daily cap, and Telegram pairing. Browser notifications are opt-in and only work while the tab is open. Web Push is not implemented.

## Phase 5 — Research tools

Done in the desk: compare (up to four), shortlist board with undo, URL analysis, preference feedback that renormalizes weights, saturation groups, research-pack ZIP, budgets, and retention.

## Phase 6 — Verification

Unit tests cover the acceptance behaviors that do not need live credentials. `pnpm --filter @radar/web build` completed. Live X and OpenAI calls were not made. See `docs/ACCEPTANCE.md`.

## Not in this build

- A trained recommendation model.
- Web Push for a closed browser.
- S3 uploads. Files stay on the `DATA_DIR` volume.
- Reddit, YouTube, or Google Trends. No official adapter is configured, and unofficial scrapers are not used.
- Token deployment, trading, wallets, or public posting.
