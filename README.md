# Pradeep Classes Management System

A dedicated institute-management web application starter for Pradeep Classes. The public institute website remains separate; deploy this app to `app.pradeepclasses.in`.

## Stack
- React + TypeScript + Vite
- Tailwind CSS + custom responsive academic dashboard UI
- Supabase (Postgres + Auth) integration foundation
- PWA and production hardening are planned for the deployment milestone

## Current milestone
- Responsive admin dashboard
- Student directory, search and add-student flow
- Teacher directory and batch overview
- Supabase client setup via environment variables
- Initial database schema and row-level-security policies

**Demo mode:** Without Supabase environment variables, the interface uses sample records in browser memory. These are not real institute records and are not saved permanently. Configure Supabase before using the system with actual students.

## Local setup
1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add your Supabase project URL and anon/public key.
5. Run `npm run dev`.

## Supabase setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/migrations/0001_initial_schema.sql`.
3. Create the first owner profile securely. Do not allow public sign-up to choose their own role. Assign the initial owner role from the Supabase SQL editor after creating the auth user.
4. Add environment variables to Vercel.

Example owner profile assignment (replace the UUID with the auth user's ID):
```sql
insert into public.profiles (id, full_name, role)
values ('AUTH-USER-UUID', 'Institute Owner', 'owner');
```

## Important security notes
- Never place the Supabase `service_role` key in frontend code or `VITE_` variables.
- The initial RLS policies are a foundation, not a completed production security review. Teacher-to-assigned-batch scoping, student/parent self-access, fee privacy, invitation flows and audit triggers must be completed before real-world use.
- Do not import real student information until authentication and policies have been tested.

## Deployment
Import the GitHub repository into Vercel, set the framework to Vite, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then add `app.pradeepclasses.in` as a Vercel domain. Only configure the `app` subdomain DNS record; do not change the existing apex/root website records.
