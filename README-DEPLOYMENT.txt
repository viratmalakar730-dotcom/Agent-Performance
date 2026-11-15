# Agent Performance Dashboard — Password Protected

## Cloudflare Pages deployment
- Project: `agent-performance`
- Build output directory: `/` (repository root)
- No build command is required for this static site.

## Required Cloudflare settings
Open Workers & Pages → `agent-performance` → Settings → Variables and Secrets.
Add these values for **Production** (and Preview too if you use Preview deployments):

1. Secret `SITE_PASSWORD` = `8563`
2. Variable `FIREBASE_API_KEY` = the exact `apiKey` from Firebase Console → Project settings → General → Your apps → your Web app → SDK setup/configuration.

Save, then redeploy. The real Firebase API key was not present in the supplied ZIP or its Git history (the source contained only `AIzaSy...`), so the project now fetches it from the Cloudflare Function instead of shipping a fake/truncated value. Do not guess an API key. Firebase Web API keys are public project identifiers, not database authorization; protect Realtime Database with Firebase Security Rules.

## Protection included
- HTML page navigation requires a fresh password on every visit/refresh.
- Static assets are served only after successful login.
- Dashboard Reset and Admin Message composer verify the password server-side.
- The old client-side password `1122` is removed.

## Notification sound
`sounds/notify.mp3` is included. It is a newly generated short two-tone notification sound and satisfies the existing `dashboard.html` audio path.

## Existing configuration
Firebase project details already present in the source were preserved:
- Project ID: `agent-performance-live`
- Auth domain: `agent-performance-live.firebaseapp.com`
- Realtime Database: `https://agent-performance-live-default-rtdb.firebaseio.com/`

The project keeps the existing dashboard design and report calculations, including the user's updated Total Login / Net Login conditional formatting.
