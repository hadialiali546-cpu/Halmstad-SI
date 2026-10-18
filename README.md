# Halmstad SI — Concept Demo

*One Platform. Less Administration. More Learning.*

An interactive proof of concept for the Supplemental Instruction (SI) programme. Four roles share one data model: Student, SI Leader, SI Coach and SI Supervisor. All people and records are fictional. This is not an official Halmstad University system.

## Run it

**Option A: no install.** Open `standalone/index.html` in Chrome, Edge or Firefox by double-clicking it. Everything is inlined, and it works offline.

**Option B: dev server.** Requires Node.js 18 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

| Script | What it does |
|---|---|
| `npm run build` | Production build into `dist/` (serve with `npm run preview` or any static host) |
| `npm run build:standalone` | Single self-contained HTML file in `standalone/` |
| `npm run typecheck` | TypeScript check |

Click **Reset demo data** (the ↺ icon in the header) before each presentation. The dataset is generated relative to today's date, so it always covers the last ~8 weeks plus the next ~3.

## Demo scenarios (also in the in-app *Demo Guide*)

1. **Attendance automation.** As SI Leader, open Attendance, register 14 students for the pending session and save. As Supervisor, open Courses → Mathematics 1 and you'll see the totals have updated. Back as Leader, open Monthly Reports → Generate, and the session is included.
2. **Coaching and quality assurance.** As SI Coach, open Observations → Pending → Alex Nilsson, Observation 2 → Complete. The KPI updates. In Monthly Reports, the observation is included. As Supervisor, the completion rate has updated.
3. **Administrative reporting.** As SI Leader, generate and submit the report. As Supervisor, open Reports & Approvals and approve it. Then open Payroll & Primula Export → Export Approved Records.


## Batch 1 upgrades (QR check-in, planning, deeper analytics)

- **QR check-in:** SI leaders start check-in on a session and get a QR code plus a 4-digit code. Students check in from their phone, and only students on the course list are accepted. When check-in closes, the names pre-fill the attendance register for the leader to review and save.
- **Session feedback:** students who attended rate the session (1–5, whether it helped, optional comment). Ratings are anonymous to leaders and shown on the leader overview, course pages and analytics.
- **Planning tools:** session plans built from templates (problem-solving, exam prep, concept review, jigsaw), with activity timings scaled to the session length. Leaders attach materials that students can download, schedule weekly repeating sessions, and request substitutes. Accepted substitutions move the session into the substitute's schedule and report.
- **Deeper analytics:** a Reach & retention tab (unique students, repeat attenders, never-attended, first-time vs returning) and a Course health tab with rule-based follow-up flags. A semester comparison sets the current term against archived VT2026 totals (fictional), and a one-click management summary PDF is included.
- Demo Guide **Scenario 4** walks through QR check-in and feedback.
- Demo limits: the QR link opens the check-in page on the same browser only, because there is no server yet. Uploaded materials are kept in browser storage, max 1.5 MB per file. Real file storage would use Supabase Storage.


## End-of-course SI evaluation and grade correlation

- **Course end dates:** each course has an end date, which the supervisor sets under SI & Results → Course end dates. In the demo, Physics has just finished. "End now (demo)" ends another course immediately.
- **SI leader evaluation:** students who attended SI get a standard 7-question evaluation (ratings, would-recommend, two open questions). The supervisor can edit the questions. Answers are anonymous to SI leaders, who see summaries only.
- **Final grade reporting (U/3/4/5):** every student on the course list, including those who never attended SI, is asked to self-report their grade with a consent tick. A reminder comes every week until they report, and stops once they do.
- **Attendance ↔ grade report:** grades by SI attendance group, pass rate by group, Spearman ρ between sessions attended and grade, and pass rate with vs without SI. Excel export includes Summary, By attendance group, Students and About sheets.
- **Visibility:**
  - Supervisors and coaches see student names: coaches for courses where their SI leaders work, supervisors for all courses.
  - SI leaders and students see anonymous statistics only. Groups smaller than 3 are hidden.
- Caveats shown in the app: grades are self-reported (production should use official Ladok results), and correlation does not prove that SI causes better grades.


## Firebase pilot (live mode)

Running on Firebase Hosting, the app detects its Firebase config at `/__/firebase/init.json` and switches to **live mode**. Opened anywhere else (dev server, `standalone/index.html`), or when "Explore the offline demo" is clicked on the login screen, it runs in **local mode** with browser storage, exactly as before.

- **Data:** each list in the data model is a Firestore collection (one document per record), and settings sit in `meta/app`. Changes are written as diffs and every screen updates in real time (`src/backend/sync.ts`). Read/unread state for notifications stays on each device.
- **Login:** Firebase Authentication with email and password, plus email verification and password reset.
- **Roles:** stored in `profiles/{uid}`. New accounts wait as *pending* until a supervisor approves them under Team Management → Accounts & access. The supervisor sets the role, links the account to a person record (a demo persona or a new record with courses), and can allow "all role views" for demo/testing.
- **First supervisor:** the deploy script writes the Cloud Shell account's email to `config/roles`. That person becomes supervisor after verifying their email.
- **Security rules (`firestore.rules`):**
  - Only approved users can read data.
  - Supervisors can change everything.
  - SI leaders and coaches can change operational data (sessions, attendance, reports, observations and so on).
  - Students can only create their own topics, time preferences, feedback, grades, evaluations and calendar link, vote on topics, and add themselves to an open QR check-in.
- **Deploy:** run `deploy-cloudshell.sh` in Google Cloud Shell. It builds, creates Firestore in europe-north2 (Stockholm), registers the web app, enables email sign-in, sets the first supervisor, and deploys hosting and rules.
- **Pilot limitations, to fix before real student data:**
  - Every approved user can read all records, because statistics are calculated in the browser. Before real data, move the grade and attendance aggregation to Cloud Functions so students and SI leaders can only read anonymous summaries.
  - Session materials are stored inside the session record (max 700 kB). Real files should go to Cloud Storage.
  - Reset demo data (supervisor only) replaces the whole shared database.

## Architecture

```
src/
  data/
    types.ts          Shared data model (User, Course, CourseAssignment, SISession, AttendanceRecord,
                      TopicRequest, TimeSlotPreference, Observation, EducationActivity, Survey,
                      WorkActivity, MonthlyReport, Notification …)
    seed.ts           Deterministic fictional dataset (4 courses, 8 leaders, 3 coaches, 2 supervisors,
                      24 students, ~110 sessions, reports, observations, EDU, surveys)
    calc.ts           Pure derived calculations: session status, statistics, report generation
    notifications.ts  Stored event notifications + reminders derived live from records
    store.tsx         Single state container (React context) persisted to localStorage; all
                      mutations are named actions, ready to be swapped for API calls
  lib/                files.ts (CSV/Excel/PDF/ICS), exports.ts (configurable datasets), i18n
  components/         shadcn/ui-style primitives (Radix + Tailwind + CVA), layout, shared report view
  pages/              student/ leader/ coach/ supervisor/ + Landing, Demo Guide, Notifications
```

Key principles:

- **One source of truth.** Dashboards never store statistics. Everything is computed from records: session status comes from schedule + attendance, report figures from sessions/observations/EDU/surveys, and notifications from open tasks.
- **Distinctions kept.** Attendance instances are not unique students. Session hours are not compensable hours (preparation follows a configurable demo rule). Observation completion is a process measure, not a quality rating. Submission is not approval. Payroll export contains only approved lines.
- **Backend-ready.** Replace the action bodies in `store.tsx` with API calls, and `load()` with a fetch. The UI does not change.

Stack: React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui-pattern components (Radix), Lucide, Recharts, React Router (HashRouter), date-fns, SheetJS, jsPDF.

## Implemented vs simulated

| Implemented (works with real data in the browser) | Simulated |
|---|---|
| Four role dashboards with shared, persistent state | Login / role switching (no authentication) |
| Session scheduling, cancellation, attendance **by student name** (course list checkboxes + guests) with duplicate protection | Email/SMS. Notifications are in-app only |
| Topic requests + voting, time-slot preferences with charts | Survey invitations; "Simulate responses" button for demo |
| Unique students reached vs attendance instances; students see sessions they attended | **Calendar connection** (Outlook/Google/Apple) — the connect step is simulated |
| "Connect your calendar" for students, leaders and coaches: real multi-event .ics download, sync options | Subscription (webcal) link is a placeholder |
| Observations (schedule, draft, complete, review) | Primula: export format is illustrative, **not validated for Primula import** |
| EDU1/EDU2 (configurable categories), attendance, reminders | Compensation rules (e.g. 1 h prep per session) are demo assumptions |
| Surveys: builder, rating/choice/free text, live statistics | Integrations with university systems (none connected) |
| Auto-generated monthly reports, submit → approve / return with comment | Swedish translation covers navigation and core actions only |
| Course analytics, programme analytics with 5 filters | |
| Excel/CSV import with preview + validation; configurable CSV/Excel exports | |
| PDF and Excel report export, .ics calendar files, reset button | |

## Connecting to real Halmstad University systems

1. **Authentication.** University SSO (SAML/OIDC via SWAMID / Microsoft Entra ID). Roles are mapped from directory groups or an admin table.
2. **Backend and database.** A hosted API (e.g. Node/.NET) with PostgreSQL, GDPR-compliant hosting in the EU, a DPIA, and role-based access control plus audit logging.
3. **Student and course data.** Ladok (course registrations, course codes) via its REST API, with agreements from the Ladok consortium and the university IT department.
4. **Scheduling and calendars.** TimeEdit for rooms and SI session times. The "Connect your calendar" button would use Microsoft Graph (university Microsoft 365) or the Google Calendar API with OAuth consent, or a personal signed ICS subscription URL served by the backend.
5. **LMS.** Canvas for course pages and announcements to students.
6. **Notifications.** University email/SMS gateway, or Teams notifications.
7. **Payroll.** HR/Primula: agree on the approved file format or integration with HR/payroll, plus approval rules, cost centres, employee IDs and validated hours rules. Real submissions stay in the HR process until it is formally approved.
8. **Governance.** Accessibility (WCAG 2.1 AA, Swedish DOS law), information classification, data retention rules, and Swedish/English localisation.
