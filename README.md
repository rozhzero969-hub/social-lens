# Social Lens

Your own social space for TikTok and Instagram profiles, saved content, reports and notifications.

**Live app:** https://rozhzero969-hub.github.io/social-lens/

## What works now

- Sign-up, email confirmation, sign-in and password recovery through Supabase Auth.
- Sign-in is required before opening a workspace. There are no demo accounts or seeded activity. Old preview data is discarded.
- Public profile previews inside saved cards and a larger viewer, using platform-hosted embeds.
- Individual Instagram posts/Reels and TikTok videos can be saved and viewed inside a profile.
- User-owned profiles, bookmarks, collections and report preferences persist in Supabase. Visible devices refresh changes within 30 seconds and when the app is reopened or regains focus.
- Row-level security isolates each user's data; browser clients cannot forge connected accounts or activity records.
- Original Social Lens logo, browser icon, home-screen icons and notification badge.
- Readable light and dark themes, responsive navigation and mobile layouts.
- Installable web app with a standalone window and a cached public app shell. Private data and authentication responses are never cached by the service worker.
- Opt-in browser notifications for incoming account changes while the app is open, with quiet hours, digest preferences and branded notification icons.

## Database

The dedicated **Social Lens** free organization (`llhwliqrcgxmjylqkqen`) now contains the live **social-lens** project (`vpzplgivfyigxdiojovy`). Its database schema and authenticated app operations have been applied. The existing Ricotta Orders project was not changed.

The GitHub Pages build connects directly to Supabase Auth and authorized database operations using a publishable browser key. Privileged internal helpers remain restricted to the server role. Repository variables supply the project URL and publishable key at build time; no server key is placed in the browser or committed to this repository.

## Still requires external setup

**Public viewing does not authorize or monitor a social account.** Profile embeds show only the public subset the platform makes available; stories, highlights, full archives and downloads are not provided. Embeds may be restricted for private/underage accounts, disabled embedding, browser privacy settings or regional restrictions. Live TikTok/Instagram connections remain disabled until registered developer applications, approved scopes and a secure OAuth backend host are configured. This is clearly shown in the connection dialog. No platform credentials, approval or monitoring access are simulated.

Scheduled monitoring, AI reports and email delivery need a deployed worker and provider credentials. Background push notifications when the app is fully closed need a push subscription and delivery service; the service worker receiver is prepared, but background delivery is not active. Browser alerts currently work while the app is open.

## Local development

Use Node.js 24 and pnpm 11.25.0. Copy `.env.example` to `.env.local` and configure the Supabase URL and publishable key from the project's dashboard. Leave server-only credentials out of public variables.

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm build:pages
```

`pnpm build:pages` exports the authenticated app at `/social-lens/` into `.local/pages-build/out`. The GitHub quality-check workflow tests, builds and publishes that artifact to Pages.

## App installation

- iPhone/iPad: Safari → Share → Add to Home Screen.
- Android/Chrome: browser menu → Install app / Add to Home Screen.
- Mac/Safari: File → Add to Dock.
- Desktop Chrome/Edge: install button or the browser install menu.

Use the app's own install control for device guidance. Installation does not automatically grant notification permission. Existing shortcuts may need to be removed and re-added to refresh their saved icon.

## Code structure

- `components/auth-screen.tsx`: authentication and password recovery.
- `components/dashboard.tsx`: signed-in workspace and responsive views.
- `components/logo.tsx`, `public/icons/`: original branding and app icons.
- `lib/client-actions.ts`: authenticated client operations with input validation.
- `lib/monitoring.ts`: baseline detection, duplicate suppression and timezone handling.
- `lib/adapters.ts`, `app/api/`: future server-hosted OAuth, synchronization and delivery.
- `supabase/migrations/`: database structure, ownership policies and restricted operations.
- `public/manifest.webmanifest`, `public/sw.js`: app installation, safe shell caching and notification rendering.

See [deployment details](docs/deployment.md) and [platform capabilities](docs/platform-capabilities.md) for operational requirements.
