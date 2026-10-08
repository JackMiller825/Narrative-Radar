# Providers

Checked while building on 2 October 2026. Quotas and model ids change. This file records what was actually read or called.

## RSS and Atom

User-supplied feed URLs, plus a curated set whose URLs returned HTTP 200 here:

- https://blog.ethereum.org/en/feed.xml
- https://hnrss.org/frontpage
- https://www.theverge.com/rss/index.xml
- https://feeds.arstechnica.com/arstechnica/index
- https://www.coindesk.com/arc/outboundfeeds/rss?outputType=xml

Conditional requests send `If-None-Match` and `If-Modified-Since`. A bad feed is stored on that subscription and the scan continues. The parser rejects a DTD and does not resolve external entities.

## Hacker News

Official API: https://github.com/HackerNews/API

Base URL `https://hacker-news.firebaseio.com/v0/`. `newstories` then `item/{id}`. The README says there is currently no rate limit. The linked article URL and the discussion URL `https://news.ycombinator.com/item?id=` are stored separately. Deleted items are skipped. A single score observation is not treated as acceleration.

## DEX Screener

Reference: https://docs.dexscreener.com/api/reference

Search used here: `GET https://api.dexscreener.com/latest/dex/search?q=`. A live call on 2 October 2026 returned `schemaVersion` and `pairs[]` with `chainId`, `pairAddress`, `url`, and `baseToken`. Several other reference routes document 60 requests per minute. This client does not assume a higher quota for search. Pairs that share a chain id and token address are collapsed. Results are partial index coverage. The UI never says a name is unique, available, or trademark-cleared.

## X

Official docs at https://docs.x.com/x-api/fundamentals/rate-limits returned HTTP 403 from this environment, so limits and prices were not re-verified. The adapter calls `GET https://api.x.com/2/tweets/search/recent` only when `X_BEARER_TOKEN` is set. Without a token the tile says not connected and no posts are invented. A 401 or 403 is shown as an access error, not as an empty trend.

## OpenAI text and images

The image guide at https://developers.openai.com/api/docs/guides/image-generation was not re-fetched successfully in this session, so no model id or size is hardcoded. The October 8 build note names `gpt-image-2.5-sunburst` as a candidate only. It is not the default, because this environment did not confirm that identifier, its sizes, or its transparency support. Calls go to `POST /v1/images/generations` only when `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, and `OPENAI_IMAGE_SIZE` are set to values the account documents. Template art does not need these keys and is labeled “Template concept.”

## Telegram

Bot API: https://core.telegram.org/bots/api

`getUpdates` and `sendMessage` run only with `TELEGRAM_BOT_TOKEN`. Pairing requires the owner to send `/start` plus a 10-minute code. Messages use HTML escaping. The bot is not given arbitrary chat ids.

## Not connected

Reddit, YouTube, licensed news search, and Google Trends are not adapters. Google Trends access is not assumed: https://developers.google.com/search/apis/trends

Object storage beyond the local `DATA_DIR` directory is not connected. Mount that directory if you need the files to survive a restart.
