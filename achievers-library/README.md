# Achievers Library

A responsive React + Vite starter website for Achievers Library, Umranala, Chhindwara.

## Current preview includes
- Premium responsive landing page
- 34-seat full-day seat map
- Demo seat selection and booking form (client-side only; not persisted)
- Searchable sample book catalogue
- Membership and contact placeholders

## Run locally
```bash
npm install
npm run dev
```

## Build for deployment
```bash
npm run build
```

## Supabase setup (next development step)
1. Create a Supabase project.
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the project's public/publishable key.
4. Never put a Supabase service-role key in frontend environment variables.

## Important
The current seat booking is a front-end demo. It does not yet save bookings to a database, send notifications, process payments, or provide live admin/student authentication. Those are the next integration steps before public launch.
