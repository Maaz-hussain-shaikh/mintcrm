# TravelCRM — Production-Ready Travel Agency CRM

A full-featured CRM system built with Next.js 14, TypeScript, Tailwind CSS v3, Supabase, and Zustand.

## Features

- **Authentication** — Email/password login with Supabase Auth, auto profile creation, Admin & Employee roles
- **Leads Management** — CSV import, CRUD, status tracking, notes, assignments, follow-up reminders
- **Calling View** — One-lead-at-a-time smart calling interface with quick status updates
- **Admin Panel** — Team performance stats, lead assignment, employee tracking
- **Attendance System** — Auto check-in on login, auto check-out on tab close, live status
- **Follow-up Notifications** — Scheduled notifications, real-time bell UI
- **Realtime** — Lead updates and attendance changes reflect instantly via Supabase Realtime

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) account

---

### 2. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) → New Project
2. Choose a name, password, and region
3. Wait for the project to be ready (~1 minute)

---

### 3. Run the Database Schema

1. In your Supabase dashboard → **SQL Editor**
2. Click **New Query**
3. Paste the entire contents of `supabase/schema.sql`
4. Click **Run** (green button)

You should see all tables, triggers, RLS policies, and realtime configuration created.

---

### 4. Get Your API Keys

In Supabase dashboard → **Settings → API**:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon public" key |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role secret" key |

---

### 5. Set Up Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

---

### 6. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

### 7. Create Your First Admin

1. Open the app → click **Sign up**
2. Create an account with your email
3. Go to Supabase dashboard → **Table Editor → profiles**
4. Find your user row → change `role` from `employee` to `admin`
5. Refresh the app — you now have admin access

---

## Folder Structure

```
travel-crm/
├── supabase/
│   └── schema.sql              # Full DB schema — run this first
├── src/
│   ├── app/
│   │   ├── (auth)/             # Login & signup pages
│   │   │   └── auth/
│   │   │       ├── login/page.tsx
│   │   │       └── signup/page.tsx
│   │   ├── (dashboard)/        # All protected dashboard routes
│   │   │   └── dashboard/
│   │   │       ├── page.tsx            # Home dashboard
│   │   │       ├── leads/page.tsx      # Leads management
│   │   │       ├── calling/page.tsx    # Smart calling view
│   │   │       ├── admin/page.tsx      # Admin panel
│   │   │       ├── attendance/page.tsx # Attendance tracking
│   │   │       └── activities/page.tsx # Activity log
│   │   ├── api/
│   │   │   ├── leads/
│   │   │   │   ├── route.ts            # GET all, POST new
│   │   │   │   ├── [id]/route.ts       # GET, PATCH, DELETE by ID
│   │   │   │   └── upload/route.ts     # CSV import
│   │   │   ├── attendance/
│   │   │   │   ├── route.ts            # GET list
│   │   │   │   ├── checkin/route.ts    # POST check-in
│   │   │   │   └── checkout/route.ts   # POST check-out (sendBeacon safe)
│   │   │   ├── notifications/route.ts  # GET + PATCH
│   │   │   └── profiles/route.ts       # GET + PATCH
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Redirects to /dashboard
│   │   └── globals.css
│   ├── components/
│   │   ├── admin/
│   │   │   └── EmployeePerformanceTable.tsx
│   │   ├── layout/
│   │   │   └── DashboardShell.tsx      # Sidebar + topbar + auto attendance
│   │   ├── leads/
│   │   │   ├── AddLeadModal.tsx
│   │   │   ├── AssignLeadModal.tsx
│   │   │   ├── CSVUploadModal.tsx
│   │   │   ├── LeadDetailModal.tsx
│   │   │   ├── LeadFiltersBar.tsx
│   │   │   └── LeadsTable.tsx
│   │   ├── notifications/
│   │   │   └── NotificationBell.tsx
│   │   └── ui/
│   │       ├── Modal.tsx
│   │       ├── StatCard.tsx
│   │       └── StatusBadge.tsx
│   ├── hooks/
│   │   ├── useLeads.ts                 # Realtime leads hook
│   │   └── useEmployees.ts
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts               # Browser Supabase client
│   │       ├── server.ts               # Server Supabase client
│   │       └── middleware.ts           # Session refresh middleware
│   ├── store/
│   │   ├── auth.ts                     # Zustand auth store
│   │   ├── leads.ts                    # Zustand leads store
│   │   └── notifications.ts            # Zustand notifications store
│   ├── types/
│   │   └── index.ts                    # All TypeScript types
│   └── middleware.ts                   # Next.js middleware (auth guard)
```

---

## CSV Import Format

| Column | Required | Format | Example |
|---|---|---|---|
| `name` | ✅ | Text | John Doe |
| `phone` | ✅ | Text | 9876543210 |
| `email` | ❌ | Email | john@email.com |
| `trip_interest` | ❌ | Text | Goa Beach Trip |
| `travel_date` | ❌ | YYYY-MM-DD | 2025-12-15 |
| `budget` | ❌ | Number | 50000 |

Download the template from within the app (Leads → Import CSV → Template).

---

## User Roles

| Feature | Admin | Employee |
|---|---|---|
| View all leads | ✅ | ❌ (only assigned) |
| Import CSV | ✅ | ❌ |
| Assign leads | ✅ | ❌ |
| Admin panel | ✅ | ❌ |
| Attendance page | ✅ | ❌ |
| Activities log | ✅ | ❌ |
| Calling view | ✅ | ✅ |
| Update lead status | ✅ | ✅ |
| Add notes | ✅ | ✅ |
| Log calls | ✅ | ✅ |

---

## Free Deployment (Vercel)

### Deploy to Vercel

1. Push your code to GitHub

```bash
git init
git add .
git commit -m "initial commit"
gh repo create travel-crm --public --push
```

2. Go to [https://vercel.com](https://vercel.com) → Import Git Repository
3. Select your repo
4. Add environment variables (same as `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Deploy**

Your CRM is live at `https://your-project.vercel.app`

### Free Tier Limits

- **Vercel**: 100GB bandwidth/month, unlimited deployments — free
- **Supabase**: 500MB database, 2GB bandwidth, 50,000 MAU — free

---

## Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | ✅ |

---

## Common Issues

**"relation does not exist" errors**
→ Make sure you ran the full `supabase/schema.sql` in SQL Editor

**Login redirects to login page**
→ Check your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct

**CSV upload fails**
→ Make sure you're logged in as **admin** (employees cannot upload CSVs)

**Notifications not appearing**
→ Make sure Realtime is enabled. The schema SQL handles this, but double-check in Supabase → Database → Replication

**Check-out not recording**
→ Make sure `SUPABASE_SERVICE_ROLE_KEY` is set — it's needed for the sendBeacon checkout endpoint

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14.2 | App Router, SSR, API Routes |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.4 | Styling |
| Supabase | 2.x | Auth, PostgreSQL, Realtime |
| Zustand | 5.x | Client state management |
| date-fns | 3.x | Date formatting |
| PapaParse | 5.x | CSV parsing |
| Recharts | 2.x | Charts |
| lucide-react | 0.5x | Icons |
| react-hot-toast | 2.x | Notifications |
