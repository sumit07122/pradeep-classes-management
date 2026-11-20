# Milestone 1: Foundation, Auth & Role-Based Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a modular, maintainable full-stack foundation for Pradeep Classes Management System featuring Supabase Auth, strict Role-Based Access Control (Owner, Admin, Teacher, Student, Parent), secure RLS policies, owner bootstrap instructions, and reusable UI components with zero build warnings.

**Architecture:** Refactor the monolithic starter into a decoupled architecture separating UI primitives, layout shell, auth context, declarative routing, and service layers. Enforce frontend route guards for UX navigation while establishing hardened Supabase Row Level Security (RLS) policies for server-side database enforcement, with complete isolation of dev-only demo toggles from production environments.

**Architecture Diagram:**

```mermaid
graph TD
    subgraph Browser ["Frontend (React + Vite + TS)"]
        Router[AppRoutes] --> Guard[ProtectedRoute / RBAC]
        Guard --> Pages[Pages: Dashboard, Students, Teachers, Batches, Portal, etc.]
        Pages --> UI[Reusable UI Library: Modal, Button, EmptyState, StatCard]
        Pages --> Services[Data Services: studentsService, teachersService, batchesService]
        Guard --> AuthCtx[AuthContext / useAuth]
        AuthCtx --> AuthService[authService]
        Services --> SupabaseClient[Supabase Client (anon key only)]
        AuthService --> SupabaseClient
    end

    subgraph Supabase ["Supabase Backend (PostgreSQL + Auth)"]
        SupabaseClient --> AuthModule[Supabase Auth (auth.users)]
        SupabaseClient --> PostgREST[PostgREST API]
        PostgREST --> RLS[PostgreSQL RLS Policies]
        RLS --> Tables[(profiles, students, teachers, batches, attendance, audit_logs)]
    end
```

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3.4, `@supabase/supabase-js` 2.49, `lucide-react`, `react-router-dom` 7.

**Spec:** User requirements for Milestone 1: modular project architecture, Supabase session auth, role-based navigation and protected routes, secure RLS policies with owner bootstrap, no fake demo stats in production, and zero TypeScript/build errors.

## Global Constraints

- Never expose Supabase `service_role` keys in client-side code or `VITE_` variables.
- Frontend role checks are for UI navigation only; authorization must be strictly enforced via PostgreSQL RLS.
- Privileged role assignment is never allowed via public registration; role bootstrap must occur via secure administrative or SQL execution.
- Dev-mode role switching must be strictly guarded behind `import.meta.env.DEV` and completely inaccessible in production builds.
- Demo/sample data must be visibly tagged `[DEMO]` and never presented as genuine institute metrics.
- When Supabase is unconfigured in production, display an informative configuration error rather than silently defaulting to mock data.
- Do not modify or interfere with the existing public Pradeep Classes website.
- `npm run build` (`tsc -b && vite build`) must pass cleanly with 0 errors.

## Review Focus

1. **Unconfigured Supabase in Production:** In production mode without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, the application displays a full-screen Configuration Required error banner instead of leaking demo data or crashing silently.
2. **Unauthorized Role Access Attempt:** When a user with role `student` navigates directly to `/admin/teachers` or `/admin/students`, the router intercepts and redirects to `/unauthorized` or their respective portal.
3. **Session Expiry / Invalidation:** When a Supabase auth token expires or the user signs out from another tab, `onAuthStateChange` clears the session state and returns the user to `/login`.
4. **Dev Role-Switching Leak:** Dev role-switching controls must not render if `import.meta.env.PROD` is true or if `VITE_ENABLE_DEV_ROLE_SWITCH` is not `true`.
5. **No Fake Statistics in Production Dashboards:** If the database table is empty or unpopulated, displays an explicit `EmptyState` ("No records recorded yet") instead of hardcoded numbers like "₹48,500" or "92%".

---

### Task 1: Type System & Domain Models

**Files:**
- Create: `src/types/auth.ts`
- Create: `src/types/database.ts`
- Create: `src/types/institute.ts`
- Modify: `src/types/index.ts` (re-export and deprecate old `src/types.ts`)

**Interfaces:**
- Produces: `UserRole` (`'owner' | 'admin' | 'teacher' | 'student' | 'parent'`), `UserProfile`, `Student`, `Teacher`, `Batch`, `AttendanceSession`, `AttendanceRecord`, `FeeRecord`, `AuditLog`.

- [ ] **Step 1: Create typed auth and role definitions** in `src/types/auth.ts` with roles `owner`, `admin`, `teacher`, `student`, `parent`, and profile schema.
- [ ] **Step 2: Create typed institute entities** in `src/types/institute.ts` with `Student`, `Teacher`, `Batch`, `AttendanceRecord`, `FeeSummary`.
- [ ] **Step 3: Centralize exports** in `src/types/index.ts` and keep backwards compatibility with `src/types.ts`.
- [ ] **Step 4: Verify typecheck:** Run `npx tsc --noEmit` and verify zero errors.
- [ ] **Step 5: Commit:** `git add src/types; git commit -m "feat(types): establish comprehensive role and domain type definitions"`

---

### Task 2: Supabase Environment Configuration & Client Hardening

**Files:**
- Create: `src/lib/env.ts`
- Modify: `src/lib/supabase.ts`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Produces: `isSupabaseConfigured: boolean`, `isDevMode: boolean`, `getSupabaseClient(): SupabaseClient | null`, `envConfig`.

- [ ] **Step 1: Create environment validator** in `src/lib/env.ts` detecting `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `isDev`, `isProd`, and `isDevRoleSwitchEnabled`.
- [ ] **Step 2: Update `src/lib/supabase.ts`** to use safe env parsing, strict client instantiation, and clear warnings when unconfigured.
- [ ] **Step 3: Update `src/vite-env.d.ts`** with typed `ImportMetaEnv`.
- [ ] **Step 4: Verify build:** Run `npm.cmd run build` to confirm clean typing.
- [ ] **Step 5: Commit:** `git add src/lib src/vite-env.d.ts; git commit -m "feat(supabase): harden supabase client initialization and environment validation"`

---

### Task 3: Common UI Library (Buttons, Modals, Badges, Empty & Error States)

**Files:**
- Create: `src/components/common/Button.tsx`
- Create: `src/components/common/Input.tsx`
- Create: `src/components/common/Select.tsx`
- Create: `src/components/common/Modal.tsx`
- Create: `src/components/common/Badge.tsx`
- Create: `src/components/common/StatCard.tsx`
- Create: `src/components/common/EmptyState.tsx`
- Create: `src/components/common/LoadingSpinner.tsx`
- Create: `src/components/common/AlertNotice.tsx`
- Create: `src/components/common/DemoBanner.tsx`
- Create: `src/components/common/index.ts`

**Interfaces:**
- Produces: Standardized UI primitives with loading states, academic branding colors, accessibility attributes, and responsive behavior.

- [ ] **Step 1: Implement form primitives** (`Button`, `Input`, `Select`) with variants (`primary`, `secondary`, `danger`, `outline`), disabled states, and error messages.
- [ ] **Step 2: Implement feedback & display components** (`Modal`, `Badge`, `StatCard`, `LoadingSpinner`, `AlertNotice`, `EmptyState`).
- [ ] **Step 3: Implement `DemoBanner`** that clearly warns when mock data is shown and prohibits confusion with real data.
- [ ] **Step 4: Export all components** from `src/components/common/index.ts`.
- [ ] **Step 5: Verify build:** Run `npm.cmd run build`.
- [ ] **Step 6: Commit:** `git add src/components/common; git commit -m "feat(ui): add reusable common UI component library with honest states"`

---

### Task 4: Layout Shell, Responsive Navigation & Dev Role Switcher

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Topbar.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/components/layout/RoleSwitcherDev.tsx`
- Create: `src/components/layout/index.ts`

**Interfaces:**
- Produces: `AppShell` handling responsive drawer, breadcrumbs, user profile dropdown, role badge, navigation links scoped by active role, and strictly DEV-only role preview switcher.

- [ ] **Step 1: Implement `Sidebar.tsx`** with role-aware menu items (Owner/Admin: all modules; Teacher: assigned classes & attendance; Student/Parent: portal view).
- [ ] **Step 2: Implement `Topbar.tsx`** with active breadcrumbs, date display, notifications icon, and user profile popover with Sign Out button.
- [ ] **Step 3: Implement `RoleSwitcherDev.tsx`** strictly guarded by `if (!import.meta.env.DEV) return null;` to let developers test role views locally.
- [ ] **Step 4: Combine into `AppShell.tsx`** with main content container and responsive sidebar overlay.
- [ ] **Step 5: Verify build:** Run `npm.cmd run build`.
- [ ] **Step 6: Commit:** `git add src/components/layout; git commit -m "feat(layout): implement responsive app shell with role-scoped navigation and dev switcher"`

---

### Task 5: Supabase Auth Service & AuthContext Provider

**Files:**
- Create: `src/services/authService.ts`
- Create: `src/context/AuthContext.tsx`
- Create: `src/hooks/useAuth.ts`

**Interfaces:**
- Produces:
  - `authService`: `signIn(email, password)`, `signOut()`, `getCurrentUser()`, `getUserProfile(userId)`.
  - `AuthContext`: `{ user, profile, role, isLoading, isAuthenticated, isDemoMode, signIn, signOut, setDevRole }`.
  - `useAuth()` hook.

- [ ] **Step 1: Implement `authService.ts`** calling Supabase `auth.signInWithPassword`, `auth.signOut`, `auth.getSession`, and fetching `public.profiles`.
- [ ] **Step 2: Implement `AuthContext.tsx`** with `supabase.auth.onAuthStateChange` listener, session persistence in local state, and graceful mock fallback in dev mode.
- [ ] **Step 3: Implement `useAuth.ts`** with convenient selector functions (`isOwner`, `isAdmin`, `isTeacher`, `isStudent`, `isParent`, `canManageStudents`).
- [ ] **Step 4: Verify build:** Run `npm.cmd run build`.
- [ ] **Step 5: Commit:** `git add src/services/authService.ts src/context src/hooks; git commit -m "feat(auth): implement supabase auth context and session persistence"`

---

### Task 6: Role-Based Routing & Access Control

**Files:**
- Create: `src/routes/ProtectedRoute.tsx`
- Create: `src/routes/AppRoutes.tsx`
- Create: `src/pages/Login.tsx`
- Create: `src/pages/Unauthorized.tsx`
- Create: `src/pages/ConfigError.tsx`

**Interfaces:**
- Produces: Declarative client routes with role verification, redirection to `/login` for unauthenticated requests, and redirection to `/unauthorized` for insufficient permissions.

- [ ] **Step 1: Implement `ProtectedRoute.tsx`** verifying `isAuthenticated` and checking `allowedRoles.includes(role)`.
- [ ] **Step 2: Implement `Login.tsx`** with email/password form, loading states, error alerts, and demo quick-login credentials in dev mode.
- [ ] **Step 3: Implement `Unauthorized.tsx`** and `ConfigError.tsx` for production missing-config handling.
- [ ] **Step 4: Assemble `AppRoutes.tsx`** with nested routes for `/admin/*`, `/teacher/*`, and `/portal/*`.
- [ ] **Step 5: Verify build:** Run `npm.cmd run build`.
- [ ] **Step 6: Commit:** `git add src/routes src/pages; git commit -m "feat(routes): implement declarative role-based routing and auth pages"`

---

### Task 7: Data Services & Page Views with Honest Empty States

**Files:**
- Create: `src/services/studentsService.ts`
- Create: `src/services/teachersService.ts`
- Create: `src/services/batchesService.ts`
- Create: `src/pages/Dashboard.tsx`
- Create: `src/pages/Students.tsx`
- Create: `src/pages/Teachers.tsx`
- Create: `src/pages/Batches.tsx`
- Create: `src/pages/Attendance.tsx`
- Create: `src/pages/Fees.tsx`
- Create: `src/pages/Academics.tsx`
- Create: `src/pages/Portal.tsx`
- Modify: `src/App.tsx` (connect to `AppRoutes` and `AuthProvider`)

**Interfaces:**
- Produces: Modularized pages using data services. When Supabase is connected, queries live records; when demo mode is active, visibly tags records with `[DEMO]`. When tables have 0 rows, renders proper `EmptyState` instead of hardcoded numbers.

- [ ] **Step 1: Implement data services** (`studentsService.ts`, `teachersService.ts`, `batchesService.ts`) with typed CRUD functions.
- [ ] **Step 2: Refactor `Dashboard.tsx`** with genuine calculations, loading skeletons, and empty state support.
- [ ] **Step 3: Refactor `Students.tsx`, `Teachers.tsx`, `Batches.tsx`** into modular views with search, filters, and add modals.
- [ ] **Step 4: Refactor `Attendance.tsx`, `Fees.tsx`, `Academics.tsx`, and `Portal.tsx`** with role-specific views.
- [ ] **Step 5: Update `src/App.tsx`** to wrap `AuthProvider` around `AppRoutes`.
- [ ] **Step 6: Verify build:** Run `npm.cmd run build`.
- [ ] **Step 7: Commit:** `git add src/services src/pages src/App.tsx; git commit -m "refactor: modularize pages and data services with honest empty states"`

---

### Task 8: Database Schema Hardening & Owner Bootstrap Process

**Files:**
- Create: `supabase/migrations/0002_enhanced_rls_and_owner_bootstrap.sql`
- Create: `docs/OWNER_BOOTSTRAP.md`
- Create: `docs/DATABASE_ARCHITECTURE.md`

**Interfaces:**
- Produces: Hardened RLS policies preventing self-escalation, restricting attendance updates to assigned batches, audit logging triggers, and documented owner bootstrap procedures.

- [ ] **Step 1: Write `0002_enhanced_rls_and_owner_bootstrap.sql`** with:
  - Prevention of self-assigned roles on `profiles` (check constraint & trigger ensuring role cannot be changed by user themselves).
  - Teacher batch-scoped access policy for attendance and student viewing.
  - Initial owner bootstrap SQL helper function.
- [ ] **Step 2: Write `docs/OWNER_BOOTSTRAP.md`** with exact instructions for provisioning the initial owner account securely.
- [ ] **Step 3: Document database schema and RLS security model** in `docs/DATABASE_ARCHITECTURE.md`.
- [ ] **Step 4: Commit:** `git add supabase/migrations docs; git commit -m "docs(db): enhance RLS policies and document secure owner bootstrap process"`

---

### Task 9: End-to-End Build, Verification & GitHub Push

**Files:**
- Modify: `README.md` (updated with architecture, roles, local setup, and bootstrap instructions)

- [ ] **Step 1: Run full production build:** `npm.cmd run build`.
- [ ] **Step 2: Verify zero TypeScript errors, lint warnings, or broken styles.**
- [ ] **Step 3: Commit all changes:** `git add .; git commit -m "chore: complete milestone 1 foundation, auth, and rbac"`
- [ ] **Step 4: Push to GitHub repository:** `git push origin main`.
- [ ] **Step 5: Generate comprehensive completion report.**
