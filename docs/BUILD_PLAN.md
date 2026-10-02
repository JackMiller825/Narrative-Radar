# Build plan

Narrative Radar is a private research desk. It discovers narrative candidates, scores them, suggests names, draws template art, and keeps an alert inbox. It does not deploy tokens, trade, or forecast prices.

## Phase 1 — Foundation

Done. Monorepo, Auth.js credentials for a single owner, Prisma schema and SQL migration, Docker Compose, desk shell, demo seed, settings and source pages.

## Phase 2 — Discovery

Done for the local pipeline. RSS/Atom and Hacker News adapters, dedupe, clustering, explainable scores, durable scan lock, and server-sent events. Demo mode runs the same pipeline on fixtures.

## Phase 3 — Branding

Done for template art and name suggestions. Five name/ticker options, collision states, SVG logo and banner, PNG export when sharp is available, and an OpenAI image job that stays failed-and-honest until a model id is configured.

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
