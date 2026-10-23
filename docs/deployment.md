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

## Simplified profiles and security (October 23, 2026)

The main navigation is Profiles, Saved and Inbox; account connections, reports and overview are under Settings. Profile cards do not load third-party frames. The viewer loads one profile at a time and separates saved posts into their own tab. Snapchat supports username-based public profile previews and supported Spotlight/Story/Lens links; it cannot be inserted as a connected/monitored account. Migration `20261023160900_snapchat_public_profiles.sql` is applied to the Social Lens project, with existing RLS/grants unchanged.

TikTok Open LIVE links point to `https://www.tiktok.com/@username/live`. This opens the platform and does not assert current broadcasting, online presence or provide a live-status notification feed. No broadcast is simulated or recorded.

The Pages export hashes each page's inline Next.js bootstrap scripts in a Content Security Policy. Scripts are limited to the app and those hashes, frames to the three platform origins, and app connections to Supabase plus an explicitly configured HTTPS backend. This policy uses a meta tag because GitHub Pages cannot set custom response headers; frame-ancestors cannot be enforced there. Styles still require inline styles for framework compatibility. Embedded pages control their own subresources. OAuth cookies are platform-bound with finite timestamps and constant-length timing-safe state comparisons; authorization responses are not cached. Encryption keys must be exactly 64 hex characters. API endpoint configuration rejects insecure remote URLs and embedded credentials.

Connection buttons check the server health endpoint for both database and provider readiness. At this release there are no configured TikTok/Meta developer secrets or hosted OAuth backend; public viewing works independently. Standard platform review/testing requirements still apply. Existing security advisories include intentionally guarded authenticated report/account-deletion definer functions and disabled leaked-password protection; this update does not claim a complete independent security audit.

The viewer also has a Stories tab. Snapchat uses its real public profile Stories viewer. Instagram opens the platform's `/stories/username/` page, and TikTok opens the creator's original profile, since their public embeds do not expose stories. These external paths do not establish story availability or LIVE status, and no automatic LIVE alerts are enabled. A verified data provider and background monitoring/delivery are still required for those alerts.

## Full Next.js hosting for account connections

The full app must host its authorization initiation request and callback on the same origin. A static Pages frontend calling a different host will not reliably retain the HttpOnly SameSite=Lax state cookie. The client now discovers the local backend automatically on full root deployments; Pages remains disabled for OAuth, and configured cross-origin endpoints are rejected.

`vercel.json` selects Next.js and invokes pinned pnpm 11.25.0 through npx for installation and build; `package.json` pins Node 24. This avoids the hosting image choosing an older global pnpm. Import `rozhzero969-hub/social-lens`, use the repository root, and retain the existing Social Lens Supabase project. Set the two public Supabase variables for the browser. Leave `NEXT_PUBLIC_BASE_PATH` and `NEXT_PUBLIC_API_BASE_URL` unset on the full host.

After the final production domain exists, set server-only `APP_URL` to its HTTPS origin, `SUPABASE_SECRET_KEY`, and a 64-hex-character `TOKEN_ENCRYPTION_KEY`. TikTok needs `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET`; Instagram needs `INSTAGRAM_CLIENT_ID`/`INSTAGRAM_CLIENT_SECRET`. Keep these out of public variables, Git history and browser bundles. Sensitive credentials require an approved destination before transfer.

Register exact callbacks `${APP_URL}/api/connect/tiktok/callback` and `${APP_URL}/api/connect/instagram/callback`. Start TikTok with an owner sandbox using Login Kit/Display API, and Instagram with an eligible creator/business test account. Verify the actual permission grants and first baseline before enabling public access. Owner login, account verification, terms acceptance and final account consent cannot be substituted with a public username. Approval for public use is a separate platform step.

Add the final app URL and password-recovery URL to Supabase's approved redirects after owner approval, preserving the existing Pages URLs until the migration is complete. Test sign-in with the same Social Lens account on the new host; session storage is origin-specific, while database records remain shared by account.

## Automatic previews and production configuration (October 23, 2026)

The full production app is https://social-lens-omega.vercel.app/. Vercel project `rozh/social-lens` tracks `main`. Production has the public Supabase configuration, server-only Supabase secret key, token-encryption key and matching `APP_URL`. The exact root URL is in Supabase's authentication redirect allowlist; the existing Pages Site URL is preserved. The deployed health endpoint recognizes the database configuration, but this readiness flag is not an end-to-end provider or database query test. TikTok and Instagram credentials remain unavailable until developer registration, verification and application setup are complete.

Profiles now render their public preview directly in the saved-profile list, using the existing username. Profile details show profile, stories access and saved posts together without tab switching. Saved content renders supported post previews automatically; unsupported links keep their original link. Frames mount when they approach the viewport and remain mounted while scrolling, avoiding a burst of remote embeds or false timeout messages for off-screen content. Video playback still follows the platform's player controls.

Snapchat's public profile preview remains the supported username-based story entry point; whether stories appear is controlled by Snapchat and the profile. Instagram and TikTok story sections use the already-saved username to link to the original platform. This change does not add arbitrary-user story retrieval, a complete media archive, verified live status or anonymous story playback. No external scraping provider, credentials or new data-sharing destination was added.
