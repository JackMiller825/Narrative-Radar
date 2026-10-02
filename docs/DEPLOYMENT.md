# Always-on deployment

A frontend-only host does not keep the radar scanning. You need five pieces running together:

1. The web app.
2. The worker.
3. PostgreSQL.
4. Redis.
5. A persistent disk for `DATA_DIR` (template files and any generated images).

Docker Compose in this repo starts all of them. On a server, run the same compose file and put a reverse proxy with HTTPS in front of port 43123. The desk has no sign-in, so anyone who can reach that address can use it.

Back up the Postgres volume and the asset volume. Do not publish ports 5432 or 6379 on a public interface. The health check for the process is `GET /api/healthz`. The detailed worker status is inside the signed-in desk, not on that public route.

Closing a browser does not stop the worker. Stopping the computer, the container, or the worker process does.

## Netlify

`netlify.toml` builds the Next.js app with pnpm. The build generates Prisma Client before `next build`. If `DATABASE_URL` is present, it also runs `prisma migrate deploy` and the seed.

Set `DATABASE_URL` in the Netlify environment. Point it at hosted Postgres that accepts Netlify's network. There is no login page.

This site does not start Redis or `apps/worker`. Manual **Scan now** runs in the web process. Interval scans run only where the worker process is deployed.
