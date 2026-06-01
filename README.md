# Nic's Golf Hub

A personal golf performance dashboard for tracking shot data, club trends, practice sessions, putting drills, and reports.

## Tech Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Vercel

## Local Setup

Install dependencies:

```sh
npm install
```

Create a local `.env` file using `.env.example` as a guide:

```sh
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
```

Start the development server:

```sh
npm run dev
```

Run checks:

```sh
npm run lint
npm run build
```

## Deployment

This app is deployed on Vercel from GitHub.

Vercel settings:

- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

Environment variables required in Vercel:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

## Supabase

Supabase is used for authentication and data storage. For deployed auth flows, make sure the Vercel URL is added in Supabase under Authentication URL configuration.
