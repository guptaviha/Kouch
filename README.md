# Kouch

couch player games for the insane.

This repo is now organized as a small workspace:

- `apps/web` — Next.js 15 host, player, and admin app
- `apps/realtime` — PartyKit realtime runtime
- `server` — legacy Socket.IO runtime kept temporarily during the migration

## Getting Started

First, run the development servers:

```bash
npm run dev
```

Or run each app independently:

```bash
npm run dev:web
npm run dev:realtime
```

For signed realtime bootstrap in local development, set the following shared env vars:
- `REALTIME_BASE_URL` for the web app to reach the PartyKit worker, typically `http://127.0.0.1:1999`
- `KOUCH_SESSION_SECRET` with the same value in both the web and realtime runtimes

Open [http://localhost:3000](http://localhost:3000) with your browser to see the web app.

You can start editing the page in `apps/web/src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

### Adding Shadcn components
Shadcn lets you add components that you want to use one-by-one instead of installing all the packages. The code is then installed into the `components/ui` folder as opposed to `node_modules` and you can import it from anywhere.

See [this link](https://ui.shadcn.com/docs/components/input) for how to add an `Input` component

### PWA Icons
Update app icons in `public/` in place of `sample-192x192.png` and `sample-512x512.png` and then update `manifest.ts` with the new icons.

### Lucide Icons
Icons are sourced from https://lucide.dev/icons/

### Framer Motion
Framer Motion for React allows you to introduce animations, transitions and motion
Refer to [this link](https://blog.stackademic.com/next-js-13-framer-motion-page-transitions-b2d58658410a) as an example and the [official docs](https://examples.motion.dev/)

## Quiz Questions

https://docs.google.com/document/d/1T1ganf7wTUQRx4nZxMIN43tdLzcT_OVc4PujUVOd3_Q/edit?tab=t.0#heading=h.jr2fk2hgznmg

## Deploying with Docker

1. Build an ARM-friendly image (Apple Silicon works too):
	```bash
	docker buildx build --platform linux/arm64 -t kouch-game:latest .
	```
2. Run it locally:
	```bash
	docker run --platform linux/arm64 -p 3000:3000 -p 3001:3001 --env-file .env.local kouch-game:latest
	```
3. Push to AWS ECR (after creating the repo) using the helper script:
Note: Not tested yet
	```bash
	export AWS_ACCOUNT_ID=xxxxxx AWS_REGION=us-east-1 ECR_REPO=kouch IMAGE_TAG=latest
	chmod +x scripts/push-to-ecr.sh
	scripts/push-to-ecr.sh
	```
	The script logs into ECR, builds for `linux/arm64`, and pushes the tagged image.

4. Build & run locally via helper script (recommended on macOS / Apple Silicon):
	```bash
	chmod +x scripts/build-run-docker-local.sh
	# defaults: IMAGE_TAG=local PLATFORM=linux/arm64
	scripts/build-run-docker-local.sh
	```
	This builds an ARM-compatible image and starts the container bound to ports `3000` and `3001`.