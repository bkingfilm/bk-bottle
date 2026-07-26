# BK Bottle · BK漂流瓶

A message-in-a-bottle for what you actually watch.

Drop 1 to 5 links from your real watch list into the sea, then pull up a stranger's bottle and see what they are watching. No account, no tracking, no algorithm.

**Live: https://yt-bottle.bkingfilm.workers.dev**

Supports YouTube (videos and playlists) and Bilibili, mixed in the same bottle.

## Why

Recommendation feeds keep showing you more of what you already clicked. This is a hand-curated way out: real people pick a few things they are genuinely watching, and you get a random one back. Not an algorithm's guess at what is "similar but different" — an actual stranger's evening.

Prior art worth knowing: [OtherTube](https://dl.acm.org/doi/10.1145/3491102.3502028) (CHI 2022) showed that exchanging recommendations with strangers does help people discover new interests. TheirTube and FlipFeed explored nearby ideas. All of them were research prototypes and are gone. This one is a product, and it stays up.

## What it does not do

- **Does not read your browsing history.** The web has no API for that, and even if it did, a full watch history leaks far more about a person than they intend to share. You paste a few links you chose. That is the whole privacy model.
- **No accounts.** Identity is a random id in your browser's localStorage, hashed into a stable sea-themed handle like `Lighthouse 280`. The server never sees anything else about you.
- **No comments or free text.** Any open text field eventually becomes a billboard. Bottles hold links only.

## How it works

Single Cloudflare Worker, KV for storage, no build step, no dependencies. The whole thing is one HTML file and one JS file.

```
public/index.html     the entire frontend
worker/src/index.js   the entire backend
server.py            local dev server (stdlib only, no pip install)
```

Some details that took real work:

- **Every link is verified server-side.** Titles and thumbnails come from YouTube's oEmbed endpoint at throw time. Made-up video ids get dropped; a bottle of only fake ids is rejected. Bilibili blocks Cloudflare's datacenter IPs entirely (`-412` on every request, no header trick helps), so Bilibili metadata is fetched by the thrower's own browser via JSONP and the server only sanitizes it.
- **Bottles you have seen never come back.** The client sends its seen-list, the server excludes it. Empty the sea and you get an invitation to throw one in.
- **Quality-weighted draws.** Each bottle carries good/bad votes in KV metadata; weights shift the odds without ever fully burying anything.
- **Remember a bottler.** Star someone whose taste you like and 70% of your future draws come from them. The other 30% stay random on purpose — turn it to 100% and you have rebuilt the filter bubble you were trying to escape.
- **Anti-spam without a rulebook.** Rate limits per IP, a channel-concentration check that rejects self-promo bottles, and no published thresholds. The rules only surface when you trip them.
- **KV free tier is 1000 writes and 1000 lists per day.** The first version listed the whole index on every draw and wrote back a fish counter each time; a few hundred visits burned half the daily quota. Now the index lives in isolate memory for 60s and the fish counter is sampled 1-in-10.

## Run it yourself

Local, no cloud account needed:

```bash
python server.py       # http://127.0.0.1:8765
```

Deploy to Cloudflare:

```bash
npm i -g wrangler
wrangler login
wrangler kv namespace create BOTTLES
cp wrangler.toml.example worker/wrangler.toml   # paste the namespace id
cd worker && wrangler deploy
```

The admin dashboard lives at `/admin?key=...`; set the key with `wrangler secret put ADMIN_KEY`.

## Notes

Seed bottles ship with the project so a fresh instance is not an empty sea. They are real videos, hand-picked, credited to placeholder bottlers.

User-submitted bottles are never committed to this repo.

## License

MIT
