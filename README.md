# Shiplog

A leaderboard of who in the crew is actually shipping. It's built from public GitHub contributions, refreshes every 3 hours, and has no server and no database.

```
cron (every 3h) → GitHub Action fetches stats → commits site/data.json → Cloudflare Pages redeploys
QR code → /join → "Join the crew" issue → bot opens a PR → you merge → they're on the board
Monday morning → Action emails the weekly recap via Resend
```

## Setup (about 15 minutes)

### 1. GitHub repo
1. Create a **public** repo called `shiplog`. It has to be public so friends can open join issues. Then push this folder to it.
2. In `config.json`, set `repo` to `your-username/shiplog`. Put yourself in `friends.json`.
3. Go to **Settings → Actions → General → Workflow permissions** and turn on:
   - **Read and write permissions**
   - **Allow GitHub Actions to create and approve pull requests** (the join bot needs this)
4. Don't add your friends as collaborators. As long as you're the only one with write access, nothing reaches the board unless you merge it.
5. Go to **Actions → update leaderboard → Run workflow** once to replace the demo data with real stats.

The built-in Actions token handles everything, so there's no personal token to create. If you hit rate limits later (unlikely under ~100 people), add a fine-grained PAT with **Public repositories (read-only)** and no other permissions. Store it as an Actions secret named `SHIPLOG_TOKEN`.

### 2. Cloudflare Pages
1. Go to **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git** and pick the repo.
2. Use these build settings: Framework **None**, build command **empty**, output directory **`site`**.
3. Deploy. Every commit the bot makes triggers a new deploy automatically.

### 3. Domain
1. Buy one with **Cloudflare Registrar** (at-cost pricing, and DNS is already in the right place). If you own one elsewhere, you can move its nameservers to Cloudflare.
2. Go to **your Pages project → Custom domains → Set up a custom domain**, for example `ship.yourdomain.com`. Cloudflare creates the DNS record and the HTTPS cert for you.
3. Update `siteUrl` in `config.json` to match.

### 4. QR code
Open `https://ship.yourdomain.com/join/`. The QR code on that page always points at whatever domain you're on. Hit **Print a poster** for a full-page version, or just screenshot it for the group chat.

### 5. Weekly email (Resend)
1. Sign up at resend.com. Go to **Domains → Add domain** and use the same domain. Its "Sign in to Cloudflare" button adds the DNS records for you.
2. Create an API key with **Sending access** only.
3. In GitHub, go to **Settings → Secrets and variables → Actions** and add:
   - Secret `RESEND_API_KEY`
   - Secret `RECAP_TO`: comma-separated emails (stored as a secret, so nobody's address ends up in the public repo)
   - Variable `RECAP_FROM`: `Shiplog <recap@yourdomain.com>`
4. Test it with **Actions → weekly recap email → Run workflow**. After that it sends every Monday around 7:45am Central.

Preview the email locally with `node scripts/recap.mjs`, which writes `recap-preview.html`.

## Optional: crew-only board
If you don't want the board public, go to **Cloudflare Zero Trust → Access → Applications → Add → Self-hosted** and enter your domain. Add a policy that allows your friends' emails. They sign in with a one-time code sent to their email. It's free for up to 50 people. Leave `/join/*` out of the policy if strangers should still be able to scan in.

## Scoring
Everything is in `config.json`. Each event is worth points: merged PR 5, review 3, opened PR 2, issue 1, commit 1, and private contribution 1. A current streak adds 2% per day, capped at +50%. Change the numbers and the next run uses them.

Private-repo work only shows up (as a plain count with no repo names) if each person turns on **Include private contributions on my profile** in their GitHub profile settings.

## Security notes
- **Nobody hands over a token.** Everything comes from public GitHub data.
- **People can only add themselves.** The join bot uses the issue *author's* login and never reads a username from issue text. Display names are stripped to letters, numbers and basic punctuation.
- **Issue text never touches a shell.** It's only passed to the scripts through environment variables, so it can't inject commands.
- **You approve every join.** The bot only opens a PR, and `validate.yml` checks every PR that touches `friends.json`.
- **The site is static**, with a strict Content-Security-Policy (`site/_headers`): there's no inline script, no third-party JS, and names are rendered as text, never HTML.
- **Email addresses and the Resend key stay in Actions secrets**, and each recap goes out as its own email so nobody sees the others' addresses.

## Local preview
```
node scripts/fetch.mjs --demo     # fake data
cd site && python3 -m http.server 8787
```
