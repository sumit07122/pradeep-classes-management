# Pradeep Classes Management System

A production-grade, secure, responsive institute management application for Pradeep Classes, designed for standalone institute operations with multi-tenant SaaS extensibility.

---

## Technology Stack

- **Frontend**: React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3.4
- **Routing & State**: React Router 7, AuthContext with Supabase Session Persistence
- **Backend & Database**: Supabase (PostgreSQL 15+, Auth, Row Level Security)
- **Deployment**: Vercel ready (app subdomain deployment: `app.pradeepclasses.in`)

---

## Milestone 1 Implementation Highlights

### 1. Modular Architecture
- `src/components/common/`: Reusable UI primitives (`Button`, `Input`, `Select`, `Modal`, `Badge`, `StatCard`, `EmptyState`, `LoadingSpinner`, `AlertNotice`, `DemoBanner`).
- `src/components/layout/`: Responsive academic layout shell (`AppShell`, `Sidebar`, `Topbar`, `RoleSwitcherDev`).
- `src/context/`: `AuthContext` with Supabase session management, auth listeners, and dev preview mode.
- `src/services/`: Decoupled data layer (`authService`, `studentsService`, `teachersService`, `batchesService`).
- `src/routes/`: Declarative protected routes with client-side role guards (`ProtectedRoute`).

### 2. Role-Based Access Control (RBAC)
Supports 5 distinct roles:
- **Owner**: Full administrative and financial control.
- **Admin**: Student, teacher, and batch management.
- **Teacher**: Batch-scoped attendance marking and academic materials.
- **Student**: Self-service portal for attendance, timetables, and results.
- **Parent**: Guardian view for attendance logs and fee receipts.

### 3. Production Security Guarantees
- **No Self-Privilege Escalation**: Frontend registration defaults to safe unprivileged roles (`student`). PostgreSQL triggers prevent role alteration by non-owners.
- **Server-Side Authorization**: Supabase Row Level Security (RLS) policies enforce database-level access control.
- **Dev Role Switcher Isolation**: The dev role preview pill is strictly conditioned on `import.meta.env.DEV` and completely omitted in production builds.
- **Honest Data Transparency**: When operating without Supabase in development, records are explicitly badged `[DEMO]`. When running in production without Supabase, a dedicated `ConfigError` page is displayed.

---

## Local Setup

1. **Install Dependencies**:
```bash
npm install
```

2. **Configure Environment Variables**:
Copy `.env.example` to `.env.local` and configure your Supabase project:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_ENABLE_DEV_ROLE_SWITCH=true
```

3. **Run Development Server**:
```bash
npm run dev
```

4. **Run Production Build Verification**:
```bash
npm run build
```

---

## Database Migrations & Owner Bootstrap

1. Open your Supabase Project SQL Editor.
2. Run `supabase/migrations/0001_initial_schema.sql`.
3. Run `supabase/migrations/0002_enhanced_rls_and_owner_bootstrap.sql`.
4. Follow [docs/OWNER_BOOTSTRAP.md](docs/OWNER_BOOTSTRAP.md) to bootstrap your initial institute owner account safely.

---

## Documentation Links

- [Owner Bootstrap Guide](docs/OWNER_BOOTSTRAP.md)
- [Database & Security Architecture](docs/DATABASE_ARCHITECTURE.md)
- [Milestone 1 Implementation Plan](docs/superpowers/plans/2026-11-20-milestone-1-foundation-auth-rbac.md)
