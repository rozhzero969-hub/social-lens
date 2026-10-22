# Deployment and operations

## Current live architecture

GitHub Pages serves the authenticated browser app. Supabase hosts its actual database and authentication service:

- Organization: Social Lens (`llhwliqrcgxmjylqkqen`), Free.
- Project: social-lens (`vpzplgivfyigxdiojovy`), eu-west-1.
- Public app: https://rozhzero969-hub.github.io/social-lens/
- Auth site URL: https://rozhzero969-hub.github.io/social-lens/

The schema is applied, email confirmation remains enabled, and public/anonymous roles cannot read user-owned tables. The new authenticated RPCs use the caller's session identity, accept no arbitrary user ID, and reject unauthorized callers. There is no sample data in this database.

## GitHub Pages

Repository variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configure the browser client. The key is publishable and deliberately safe to expose with the ownership policies. Never put a server/secret key in a `NEXT_PUBLIC_` variable.

The `ci.yml` workflow verifies the app, builds the static client with `pnpm build:pages`, and deploys `.local/pages-build/out`. The build supplies the base path and rewrites manifest icon paths. Server routes remain excluded. Pages settings use GitHub Actions rather than a source branch folder.

If authentication URLs change, update both Supabase Auth site/redirect settings and the deployed frontend URL. Keep confirmation emails enabled. Supabase's built-in email provider has development limits; configure production SMTP before inviting a larger beta. No confirmation setting was weakened to make tests easier.

## Installation and notifications

The manifest declares a standalone app, proper icons and the correct scope. The service worker caches the public shell and static assets only; it never caches Supabase requests, API responses, session tokens or user data. The app requires a live authenticated session to open a workspace.

Browser alerts are opt-in. Incoming realtime account-change records respect ownership, per-account alert preferences, digest-only mode and quiet hours in the user's timezone. Notifications use Social Lens icons and open the app when clicked. Initial data loading does not produce historical alerts.

Background delivery is not active. To receive notifications after fully closing the app, implement authenticated push subscription storage, a VAPID signing service and queued delivery. The service worker already handles incoming push events, but the UI accurately labels current alerts as working while the app is open.

## Future platform connections and worker

Register approved TikTok and Instagram applications and deploy the complete Next.js backend on a server-compatible host. Configure server-only secrets from `.env.example`, exact HTTPS OAuth callbacks and `NEXT_PUBLIC_API_BASE_URL` to enable the real connection buttons. Platform app review and approved scopes are required. Saved usernames are links until that setup is completed.

The existing queue and worker code still requires deployment. AI reports require an OpenAI API key/model, email delivery requires Resend, and the scheduler requires `APP_URL` and `CRON_SECRET`. Existing database migrations are recorded as applied; future migrations must use owner-authorized access scoped to this new project.

Before a public monitoring beta, test real provider permissions, pagination, rate limits, expiry, revocation, retention and deletion. The current adapters fetch a recent media window, which is insufficient for high-volume reconciliation without further live testing.

## Public profile viewer and device synchronization

Public profile and post previews use fixed-origin TikTok/Instagram iframes, isolated from the authenticated app. No third-party scripts run in the parent document, no arbitrary embed HTML is accepted, and no external retrieval service key is required. The provider controls which public details and recent media appear. Stories, highlights, complete archives and downloads are not available through these embeds. A finished iframe navigation is not treated as proof that content is available; reload and original links remain available.

Profiles, bookmarks, read status and report preferences use the same Supabase account on every device. While visible and online, the workspace refreshes every 30 seconds and on focus, visibility restoration and reconnection; existing realtime report/change inserts are preserved. No new database grants or publications are required for this fallback. Stale in-flight loads cannot overwrite a newer account session. Theme and notification permission remain device-local.
