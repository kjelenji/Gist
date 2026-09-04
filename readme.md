# gist

Weekly icon puzzle. **All app code is in `myapp/`.**

## Run locally

```bash
cd myapp
npm install
npm run dev
```

The scoreboard uses this project's public Supabase anon key by default.
To point at a different project, copy `myapp/.env.example` → `myapp/.env`.
Run `myapp/supabase/schema.sql` in the Supabase SQL editor if tables are missing.

## Deploy (Cloudflare)

App root is `myapp`. The build produces a Worker in `.svelte-kit/cloudflare` — do **not** run `node build` (that starts a Node server and never exits).

- Root directory: `myapp`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy` (not `adapter-cloudflare`, not `node build`)
- Compatibility flag: `nodejs_als` (already set in `wrangler.jsonc`)

## How it works

- One puzzle play **per username per week**
- Finishing assigns a random username (`Gist_xxxx`), saves score + collectible to Supabase
- Same browser can’t replay that week (and the server rejects duplicate username/week scores)

## Pages

| Page        | URL            |
|-------------|----------------|
| Home        | `/`            |
| Puzzle      | `/puzzle`      |
| Result      | `/result`      |
| Scoreboard  | `/leaderboard` |
| Terms       | `/terms`       |
