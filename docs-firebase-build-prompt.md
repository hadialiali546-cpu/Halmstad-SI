# Build prompt: Halmstad SI (full-stack on Firebase)

> Paste everything below into Firebase Studio (App Prototyping agent / Gemini in Firebase) or any Firebase-aware coding agent.
> If you can, first import the prototype code (`halmstad-si-demo.zip`, React + TypeScript). Then the agent extends working code instead of starting from zero.

---

## 1. Your role and goal

You are a senior full-stack engineer working on Firebase. Build **Halmstad SI**, a production-ready web platform for the Supplemental Instruction (SI) programme at Halmstad University, Sweden.

Tagline: *One Platform. Less Administration. More Learning.*

The platform connects four roles: **Student, SI Leader, SI Coach, SI Supervisor**. One recorded activity must feed every downstream report automatically: attendance → statistics → monthly reports → supervisor approval → payroll export.

Always use the official **Firebase agent skills** (firebase-basics, firebase-auth-basics, firebase-firestore, firestore-rules-creation, firebase-security-rules-auditor, firebase-hosting-basics) and the Firebase CLI via `npx -y firebase-tools@latest`.

## 2. Fixed project settings (do not change)

- **Firebase project:** `si-halmstad`
- **Web app ID:** `1:206572087324:web:e51a37889ad841545317d9`. Fetch the config with `npx -y firebase-tools@latest apps:sdkconfig WEB <APP_ID>`.
- **Firestore:** the `(default)` database in **europe-north2 (Stockholm)**. Check with `firestore:databases:list` and reuse it if it exists.
- **Authentication:** Email/Password, enabled through `firebase.json` → `"auth": {"providers": {"emailPassword": true}}` and `deploy --only auth`. Require email verification for privileged accounts.
- **Hosting:** Firebase Hosting at `https://si-halmstad.web.app`.
- **Backend logic:** Cloud Functions (2nd gen, Node 20, TypeScript) in **europe-north1** or europe-north2 if available. The project must be on the Blaze plan; ask me before upgrading.
- **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui, lucide-react, Recharts, date-fns, SheetJS (Excel), jsPDF (PDF).
- **Languages:** English first, with a complete Swedish translation (i18n keys everywhere).

## 3. Roles, accounts and access

- New users sign up with email and password and get role **pending**. A supervisor approves them and assigns a role, links courses (students: enrolments; leaders: course assignments) and links coaches to leaders.
- Store roles in **custom claims**, set only by a Cloud Function callable by supervisors, and mirror them in `profiles/{uid}`. Rules must use `request.auth.token.role`. Users can **never** set their own role.
- **First supervisor:** bootstrap from `config/roles.supervisors`, a list of emails written by the project owner, and only when `email_verified == true`.
- Supervisors can give test accounts "view all roles" (demo mode) through a claim.
- **Permissions matrix:**
  - **Student:** read the schedule for their courses; create own topic requests, votes, time preferences, session feedback, end-of-course evaluation and self-reported grade; check in to an open session. Read only **anonymous** statistics.
  - **SI Leader:** manage own sessions (schedule, recurring, cancel, plans, materials, QR check-in), register attendance by student name for own sessions, manage topic statuses for own courses, own monthly reports, substitute requests. Read anonymous statistics and anonymous evaluations of themselves.
  - **SI Coach:** observations for assigned leaders, EDU1/EDU2 activities, surveys, own monthly reports. Read named attendance and grades for courses where their leaders work.
  - **SI Supervisor:** everything, including approvals, team assignments, course end dates, import/export, payroll export, evaluation questions and account management.

## 4. Data model (Firestore, top-level collections)

Use string ISO dates for display fields and `Timestamp` for createdAt/updatedAt. Document IDs come in brackets.

- `profiles/{uid}`: email, name, role, userId (link to `people`), createdAt. Readable only by the owner and supervisors.
- `people/{personId}`: name, role, programme. **No email** (public within the app).
- `peopleContacts/{personId}`: email. Readable by coach and supervisor only.
- `courses/{id}`: code, name, faculty, credits, endDate.
- `courseAssignments/{id}`: courseId, leaderId.
- `coachAssignments/{leaderId}`: coachId.
- `enrollments/{studentId_courseId}`: studentId, courseId.
- `sessions/{id}`: courseId, leaderId, start, durationMin, location, topic, cancelled, plan {goals, activities[], notes}, materials[] (Cloud Storage paths), originalLeaderId.
- `checkins/{sessionId}`: codeHash, openedAt, closedAt. Students write `checkins/{sessionId}/students/{studentId}` with the code, and a Cloud Function verifies it against the hash.
- `attendance/{sessionId}`: studentIds[], guests, count, notes, recordedBy, recordedAt, editedAt. One record per session, so duplicates are impossible.
- `topics/{id}`: courseId, studentId, text (≤120), voterIds[], status (open | planned | addressed | not_selected).
- `timePrefs/{studentId_courseId}`: slotIds[].
- `feedback/{sessionId_studentId}`: rating 1–5, helpful (yes | partly | no), comment ≤1000. Anonymous to leaders.
- `observations/{id}`: leaderId, coachId, courseId, number (1 | 2), period, status, date, attendees, description, wentWell, improve, recommendations, reflections.
- `eduActivities/{id}`: category (configurable, e.g. EDU1, EDU2), title, start, durationMin, location, participantIds[], attendedIds[], status.
- `surveys/{id}` and `surveys/{id}/responses/{personId}`.
- `workActivities/{id}`: userId, date, category, hours, description.
- `reports/{ownerId_yyyy-MM}`: role, month, status (draft | submitted | approved | returned), metrics snapshot, lines[{category, hours, detail}], notes, reflections, supervisorComment, history[].
- `grades/{courseId_studentId}`: grade (U | 3 | 4 | 5), consent (true), reportedAt.
- `evaluations/{courseId_studentId}`: leaderId, answers{}.
- `notifications/{id}`: recipientIds[], title, body, link, kind, createdAt. Read state lives in `profiles/{uid}/reads/{notificationId}`.
- `aggregates/{courseId}`: written **only by Cloud Functions**. Holds anonymous totals: sessions, attendance instances, unique students, attendance groups × grades, Spearman ρ, pass rates, evaluation averages per leader. Groups with fewer than 3 students are hidden.
- `config/roles`, `config/settings` (prep hours per session, observation hours, and so on), `config/evaluationTemplate`.

## 5. Features to build (the prototype already shows all of them)

- **Student:** upcoming sessions with .ics export and "Connect your calendar" (subscription feed served by a Cloud Function at `/calendar/{token}.ics`), topic requests with voting, preferred times chart, QR/code check-in, session rating, end-of-course SI evaluation, final grade report (U/3/4/5).
- **SI Leader:** sessions list with derived status (scheduled, completed, attendance pending, cancelled), weekly recurring scheduling, session plans from templates, materials upload to Cloud Storage, QR check-in screen with live list, attendance register by name (pre-filled from check-ins, plus a guests count), student requests, substitute requests, monthly report auto-generated from records (edit text, submit), anonymous feedback and evaluations.
- **SI Coach:** two observations per leader per period (schedule, form, complete), EDU1/EDU2 scheduling, attendance and reminders, survey builder (rating, choice, text) with charts, monthly coaching report built from observations, EDU and surveys plus manual activities.
- **SI Supervisor:**
  - KPI overview and analytics (attendance over time, sessions per course, average attendance, leader activity, observation completion, reporting status), with filters for month, semester, course, faculty and leader.
  - Reach and retention, course health flags, semester comparison, management summary PDF.
  - Reports inbox (approve, or return with a required comment), team management and approvals.
  - Course end dates; SI evaluation question editor.
  - Attendance ↔ grade correlation with named student list and Excel export; Excel/CSV import with validation and preview; configurable exports.
  - Payroll export of **approved records only**, labelled "Demo export format — not validated for Primula import".
- **Notifications and reminders:** generated from records, e.g. missing attendance, sessions today or tomorrow, observations outstanding, reports awaiting approval, and a weekly "report your exam result" reminder until the student answers. Send them in-app first; email via the Firebase "Trigger Email" extension later.

## 6. Cloud Functions (server-side, trusted)

- `setRole` (callable, supervisor only): sets custom claims and updates `profiles`, `people`, enrolments and assignments.
- `onAttendanceWrite`, `onGradeWrite`, `onEvaluationWrite`, `onFeedbackWrite`: recompute `aggregates/{courseId}` and refresh any draft monthly report.
- `verifyCheckin`: compares the hashed code; on success adds the student to the session's check-in list.
- `generateMonthlyReport` (callable) and `decideReport` (callable, supervisor only): snapshot the metrics and keep the history.
- Scheduled jobs (Europe/Stockholm):
  - daily: reminders (missing attendance, sessions today or tomorrow);
  - weekly on Mondays: grade reminders for finished courses;
  - monthly on the 1st: draft reports.
- `exportPayroll` (callable, supervisor only): approved lines only, as XLSX in Cloud Storage with a signed URL.
- `calendarFeed` (HTTPS): a per-user secret token that returns an ICS feed.

## 7. Security, privacy and GDPR (mandatory)

- Write `firestore.rules` and `storage.rules` following the **firestore-rules-creation** skill:
  - default deny, least privilege, role checks from custom claims;
  - validator functions for **every** create and update, with strict field allow-lists, type checks and size limits;
  - immutable owner fields; no PII readable by other students.
- Grades, evaluations and named attendance are never readable by students or SI leaders. They only read `aggregates`.
- Run the Devil's-advocate checklist and then the **firebase-security-rules-auditor** skill. Validate with `deploy --only firestore:rules --dry-run`. Write emulator tests (`@firebase/rules-unit-testing`) for every role and every collection.
- Keep all data in the EU (Stockholm). Add a privacy notice at sign-up, consent for grade reporting, and "download my data" / "delete my account" (a Cloud Function that removes or anonymises the person's documents). Add data retention: delete named grades and evaluations 12 months after the course ends and keep the aggregates.
- Grades are self-reported. Design them so that official results (Ladok) can replace them later. Correlation is not causation, and the UI must say so.

## 8. Design system

- Scandinavian university look: navy `#12304A`, teal `#008D95`, background `#F7F9FB`, white cards with subtle borders, Inter font.
- Fixed left sidebar on desktop with a collapsible menu on mobile; WCAG 2.1 AA.
- A visible "Pilot" badge. Use no official university logos.

## 9. Delivery plan (stop after each phase, show me the result and wait for "go")

1. **Foundation:** project setup, Auth (Email/Password, verification, reset), profiles and approvals, custom claims, base rules with emulator tests, Hosting deploy.
2. **Core:** courses, enrolments, sessions, attendance by name, QR check-in, notifications.
3. **Reporting:** monthly reports, approvals, analytics, aggregates functions, payroll export.
4. **Students and coaching:** topics, times, feedback, observations, EDU, surveys, end-of-course evaluation, grades and correlation.
5. **Admin and hardening:** import/export, GDPR tools, scheduled reminders, rules audit, Swedish translation, PWA.

For every phase: run `npm run build`, the emulator tests and a manual test of the related scenario, then deploy with `npx -y firebase-tools@latest deploy --only auth,firestore,functions,hosting,storage`.

## 10. Acceptance scenarios (must pass end-to-end with real accounts)

1. The leader registers 14 named students → the supervisor's course statistics increase by 14 → the leader's monthly report includes the session.
2. The coach completes Observation 2 for a leader → the coach's KPI and report update → the supervisor's completion rate updates.
3. The leader submits a report → the supervisor approves it → the payroll export contains only approved lines.
4. A student checks in with the code → the leader's register is pre-filled → the student rates the session.
5. A course ends → the student evaluates SI and reports a grade (reminded weekly until done) → the supervisor sees the correlation and exports Excel; leaders and students see anonymous statistics only.
6. Security: a student cannot read another student's grade, cannot change their own role and cannot write attendance. A leader cannot approve reports.
