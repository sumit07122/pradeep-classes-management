# Pradeep Classes Management Platform — Production Deployment Guide

**Target Subdomain:** `app.pradeepclasses.in`  
**Public Website (Untouched):** `pradeepclasses.in`  
**Hosting Provider:** Vercel Global Edge Network  
**Database Provider:** Supabase PostgreSQL (`gajibrwnccddnrbnhwmh`, Sydney `ap-southeast-2`)  

---

## 1. Domain & DNS Routing Policy

> [!IMPORTANT]
> The public marketing site `pradeepclasses.in` MUST NOT BE TOUCHED OR REPLACED.
> The institute management application is strictly deployed to the subdomain `app.pradeepclasses.in`.

### DNS Record Setup (in Cloudflare, GoDaddy, or Namecheap)
Add the following DNS CNAME record to route the management portal:

| Type | Name / Host | Target / Value | TTL | Proxy Status |
|---|---|---|---|---|
| **CNAME** | `app` | `cname.vercel-dns.com` | Automatic / 300s | DNS Only (or Proxied) |

---

## 2. Environment Variables Configuration

In your Vercel Project Settings > **Environment Variables**, configure the following variables for **Production** and **Preview** environments:

```bash
# Supabase Project Connection (Production)
VITE_SUPABASE_URL=https://gajibrwnccddnrbnhwmh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamlicnduY2NkZG5yYm5od21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxNzQzMjUsImV4cCI6MjExMDc1MDMyNX0.bRIRMF6UZB6VbYaa9yZNO74-0RXMW_4vWnfLCotrrrw

# Role Switcher Guard (MUST BE FALSE IN PRODUCTION)
VITE_ENABLE_DEV_ROLE_SWITCH=false
```

> [!CAUTION]
> Ensure `VITE_ENABLE_DEV_ROLE_SWITCH=false` in production. This completely disables the client-side role switcher bar and enforces strict database-evaluated JWT authentication.

---

## 3. Database Migration Status

All 9 migrations have been verified and applied to remote production database `gajibrwnccddnrbnhwmh`:

1. `0001_initial_schema.sql`: Core tables, profiles, batches, students.
2. `0002_role_permissions.sql`: Core RBAC triggers and policies.
3. `0003_parent_portal.sql`: Historic schema (now deprecated and removed from client).
4. `0004_attendance_and_fees.sql`: Foundation roll call and fees.
5. `0005_student_batch_management.sql`: Multi-tenant institutes and admission sequencing.
6. `0006_security_integrity_fixes.sql`: Anti-escalation, batch allocation triggers, and search_path hardening.
7. `0007_attendance_management.sql`: 48-hour modification limits and roll call RPC.
8. `0008_fee_management.sql`: Row-locking fee payment collection and ledger immutability.
9. `0009_complete_institute_management.sql`: Examinations auto-grading, timetables conflict engine, study materials storage, announcements, and WhatsApp Cloud API queue.

---

## 4. Vercel Deployment Configuration (`vercel.json`)

Ensure the project root contains a `vercel.json` file to support client-side Single Page Application (SPA) routing:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

---

## 5. Deployment Verification Checklist

After deploying to Vercel:
1. Open `https://app.pradeepclasses.in`.
2. Confirm the browser address bar loads with valid SSL padlock.
3. Check that the PWA manifest loads (`/manifest.json`) and the Pradeep Classes favicon displays.
4. Log in using an Owner/Admin account.
5. Verify that all 13 sidebar navigation items render and load data without errors:
   - Overview
   - Students
   - Teachers
   - Batches
   - Attendance
   - Fee Records
   - Exams & Marks
   - Timetable
   - Study Materials
   - Announcements
   - Reports
   - Settings
6. Switch to a Student account and verify that:
   - User lands on `/portal`.
   - Admin routes (`/fees`, `/students`, `/teachers`, `/settings`) return `403 Access Denied`.
   - The Parent Portal does not appear in navigation or routing.
