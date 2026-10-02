# Acceptance

Evidence from this workspace on 2 October 2026.

| Check | Result |
| --- | --- |
| Fixture item creates one candidate, five names, logo, banner, and one inbox alert | `packages/core/test/radar.test.ts` |
| Replaying that item does not duplicate the candidate or alert | same |
| Syndicated copy does not raise the independent count | same |
| Same person, different event stays separate; same event keeps its id | same |
| Presets and custom intervals; invalid custom values throw | same |
| Older pending schedule rows are cancelled | same |
| Two lock attempts cannot both hold the scan | same |
| Budget reservations stay inside the limit under concurrency | same |
| Missing acceleration stays null and says insufficient history | same |
| Name search failure is `not_checked`, never “unique” | provider test; DEX pairs for one token are deduped |
| Illustration cache key ignores the name | same |
| Quiet hours, daily cap, hysteresis, and pre-monitoring suppression | same |
| Hostile excerpt stays out of the system task; invented evidence ids fail | same |
| Private URLs, credential URLs, and private redirects are blocked | same |
| Research pack includes the selected name and refuses a missing asset | same |
| Event gap asks for a snapshot | same |
| Unauthorized API without a session | proxy returns 401; `GET /api/desk` without a cookie returned 401 |
| Signed-in desk | Browser pass: login, Live Radar, Scan now, visuals, shortlist move, sign out. A fresh tab does not show a false “new updates” banner. |
| Production build | `pnpm --filter @radar/web build` generates Prisma Client, then `next build` |
| Unit tests | 26 passed |

## Still needing your credentials

- X recent search. Docs were not readable (HTTP 403) and no token was present.
- OpenAI text and image. No key or documented model id was set. Template art is the preview.
- Telegram delivery. No bot token was set. Pairing and the test button are in the product.
- A full live scan of the curated feeds was not left running. Endpoint checks for the curated feed URLs, Hacker News `newstories`, and a DEX Screener `PEPE` search returned HTTP 200.

## Known limits

- Browser notifications stop when the tab closes. Web Push is not implemented.
- Demo mode does not call DEX Screener, so collision status stays “not checked” until you switch to live and press Check names.
- Dollar amounts are assumptions you type in. They are not invoices. Empty assumptions show no dollar figure.
- Local scanning runs only while this machine and the worker process are up.
- Exactly-once delivery to Telegram is not promised. A timeout after the bot accepts a message can show a rare duplicate.
- Core browser flows were exercised in a desktop session. Playwright is not wired up in this repo.
