# Web App

This app contains the Next.js 15 UI for:
- host pages
- player pages
- admin pages
- non-realtime HTTP APIs

## Deployment target
Deploy this app independently to a web host such as Netlify, Vercel, or another Node-compatible platform.

## Local development
From the repo root:
- `npm run dev:web`
- `npm run build:web`

## Environment
Create or link `apps/web/.env.local` for app-local environment variables.

Important public runtime variables should describe the cross-app boundary explicitly, for example:
- `NEXT_PUBLIC_REALTIME_BASE_URL`
