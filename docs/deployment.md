# Deployment and operations

## GitHub Pages preview

The public Pages URL serves a static export of the interactive dashboard with sample data, local bookmarks, saved profile links, sample reports and preferences. `pnpm build:pages` prepares an isolated static build in `.local/pages-build/out` using the repository base path `/social-lens`. It excludes all server routes and explicitly clears browser Supabase configuration so the preview never attempts to use an absent backend.

The `ci.yml` workflow checks the app, then builds and deploys this artifact on the main branch. Repository Pages settings must use **GitHub Actions**, rather than publishing the `main` source folder. Publishing the source folder lets Jekyll render the README, which is documentation rather than the app.

GitHub Pages does not host the live API, OAuth callbacks, database or worker. The complete Next.js app still needs a server-compatible host and the setup below for real account monitoring.

## Web host

Deploy the private repository on a Node-compatible Next.js host. Use Node 24, `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm start` (adjust hostname for the chosen host). Add the environment variables from `.env.example` through the hosting secret manager. A production host must bind to its required network interface; the local scripts intentionally bind loopback.

Generate server secrets using `openssl rand -hex 32` for `TOKEN_ENCRYPTION_KEY` and `CRON_SECRET`, store them securely, and do not commit them. Changing the encryption key requires migrating stored credentials or reconnecting accounts.

Set `APP_URL` to the exact HTTPS origin, without a trailing slash. Add exact redirect URLs in provider consoles:

- `https://YOUR_HOST/api/connect/tiktok/callback`
- `https://YOUR_HOST/api/connect/instagram/callback`

Use the same URLs in app review submissions. Do not claim working integrations before the platform approves the use case.

## GitHub / Supabase linkage

The repository contains migrations and a manual deployment workflow. Set the scoped project token and database password as GitHub encrypted secrets; the project ref is a repository variable. No backend credentials belong in the browser build. Only the Supabase URL and publishable key use `NEXT_PUBLIC_`.

The current organization exists but cannot be accessed with the current authorization for project creation. Finish that authorization before using the workflow. No other Supabase project should be repurposed to avoid this restriction.

## Worker

Set GitHub repository variable `APP_URL` and secret `CRON_SECRET` to match the host. The workflow calls `POST /api/jobs` every 15 minutes; it skips accounts whose last successful check was under an hour ago. GitHub schedules are best effort, and private repository Actions usage limits apply. A dedicated scheduler and durable queue consumer are recommended before growth.

Each tick performs connected account checks, retention cleanup, due daily reports and queued email delivery. Email failures retry up to three times with backoff. The job table supports row locking and reclaims stale jobs. Email idempotency keys suppress duplicate deliveries at the provider.

Reports include coverage and observed facts. Without an AI provider, the deterministic summary explicitly remains labeled as a verified record summary. AI uses supplied records only; credentials are excluded. Review real output quality before enabling it for beta users. Report language preference is passed to the AI; the deterministic fallback and app interface are currently English.

## Verification before beta

Run migration and RLS tests, production build, actual Supabase advisors, and live provider acceptance tests. Verify two distinct users cannot read/write each other's data. Test denied/reduced permissions, refresh expiry, failures, baseline suppression, disconnect during an in-flight sync, deletion, retention and account revocation. Run real tests across midnight and daylight-saving transitions.

No production data, real social credentials, emails or AI API calls were used to populate the preview workspace.
