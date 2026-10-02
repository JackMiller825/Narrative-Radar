# Architecture

The web process serves the desk and authenticated HTTP routes. The worker process is separate. Closing the browser does not stop it. Both talk to PostgreSQL. Redis and BullMQ carry scan jobs when Redis is up. If Redis is down, the worker still scans through a database lock so a restart does not run two overlapping scans.

## Flow

`Fetch → normalize → dedupe → cluster → score → names and template art → persist → alert outbox → dashboard event`

Demo mode skips the network fetch and can replay one labeled fixture. Live mode fetches enabled RSS feeds and a bounded set of new Hacker News stories. X is called only when `X_BEARER_TOKEN` is set.

## Scheduling

The saved interval is an elapsed duration from 60 seconds to 24 hours. Presets are 1 minute, 5 minutes, 15 minutes, and 1 hour. The default is 5 minutes. Changing it bumps `scheduleVersion` and cancels older pending schedule rows. A failed attempt updates the last-attempt time and the next due time. It does not clear the last success time.

A one-minute schedule means eligible sources are asked about once a minute, up to 1,440 times a day before pagination. It does not mean every internet event arrives within a minute. Each provider still has its own practical cadence. Hacker News has no documented rate limit. DEX Screener checks are on demand. RSS uses conditional requests.

## Scoring

Narrative score, evidence confidence, and data coverage are separate. Weights start at freshness 20, acceleration 20, novelty 15, spread 15, meme 15, chain relevance 10, and name distinctiveness 5. Missing components are omitted and the remaining weights are renormalized. They are not stored as zero. Acceleration needs two observations of the same metric. One cumulative count is insufficient history. A zero baseline that becomes non-zero is labeled new activity, not infinite growth.

Meme potential is a subjective heuristic unless a configured text model returns a validated note. Syndicated copies do not increase the independent-source count. Repeated identical text is a concentration signal, not a bot verdict.

## Clustering

Items join an event when titles or content hashes match, or when the event signature overlaps. Person names alone do not merge two stories. A later article about the same event keeps the narrative id.

## Assets

Template SVG is drawn from a fixed set of motifs and palettes. The illustration cache key ignores the name. Changing a name redraws the text layer only. AI images, when configured, are extra versions. A failed AI job leaves the template in place.

## Alerts

Candidate creation and alert rows are written in the same persistence step, with an outbox row. Dedupe keys stop a second new-candidate alert when a syndicated copy arrives. Score alerts re-arm only after the score falls below the threshold by the hysteresis gap. Quiet hours use the saved IANA timezone. Digest-mode alerts are held. The inbox does not wait for an image.

## Security

Routes, exports, and the event stream require a session. RSS and manual URL fetches allow only public HTTP(S), reject credentials in the URL, and check resolved addresses for private, loopback, and link-local ranges before following a redirect. Feed XML rejects a DTD. Model evidence is wrapped so feed text cannot replace the system task. Exports prefix spreadsheet cells that start with `=`, `+`, `-`, or `@`.
