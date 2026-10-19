import { useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, Eye, FileCheck2, Sparkles, QrCode, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader, AutomationNote } from '@/components/ui/misc';
import { ResetButton } from '@/components/layout/AppShell';

const scenarios = [
  {
    icon: ClipboardCheck, title: 'Scenario 1 — Attendance automation', start: '/leader/attendance', startLabel: 'Start as SI Leader',
    value: 'Attendance automatically updates course statistics and monthly reports.',
    steps: [
      'SI Leader → Attendance: choose a session marked “Attendance pending” (yesterday’s Mathematics 1 session).',
      'Register 14 attending students and save.',
      'Switch to SI Supervisor → Courses → Mathematics 1. Total attendance and the trend chart include the new session.',
      'Switch back to SI Leader → Monthly Reports → Generate Monthly Report.',
      'The session appears in the “Sessions included” table of the draft.',
    ],
  },
  {
    icon: Eye, title: 'Scenario 2 — Coaching and quality assurance', start: '/coach/observations', startLabel: 'Start as SI Coach',
    value: 'Observations automatically contribute to the coach’s reporting record.',
    steps: [
      'SI Coach → Observations: filter on “Pending”.',
      'Open Observation 2 for Alex Nilsson, fill in the form and choose Complete Observation.',
      'Overview: the “Observations completed” KPI increases.',
      'Monthly Reports → Generate/refresh: the observation is included automatically.',
      'Switch to SI Supervisor → Overview/Analytics: the observation completion rate is updated.',
    ],
  },
  {
    icon: FileCheck2, title: 'Scenario 3 — Administrative reporting', start: '/leader/reports', startLabel: 'Start as SI Leader',
    value: 'Approved reports become eligible for administrative export.',
    steps: [
      'SI Leader → Monthly Reports → Generate Monthly Report for the current month.',
      'Review the draft, add reflections and Submit to Supervisor.',
      'Switch to SI Supervisor → Reports & Approvals: open the submitted report and Approve it.',
      'Open Payroll & Primula Export: the approved hours now appear as exportable.',
      'Click Export Approved Records to download the (demo-format) file.',
    ],
  },
  {
    icon: QrCode, title: 'Scenario 4 — QR check-in and feedback', start: '/leader/sessions', startLabel: 'Start as SI Leader',
    value: 'Students check themselves in; names flow straight into the attendance register.',
    steps: [
      'SI Leader → My Sessions → Attendance pending → QR check-in → Start check-in. Note the 4-digit code.',
      'Switch to Student → Overview: enter the code in “Check-in is open”.',
      'Back as SI Leader: click “Simulate students scanning” a few times, then Close check-in.',
      'Review attendance register: names are pre-filled — save.',
      'As Student, rate the session. As SI Leader, see the anonymous rating on the Overview; as Supervisor, see Analytics → Reach & retention.',
    ],
  },
  {
    icon: GraduationCap, title: 'Scenario 5 — SI evaluation and exam results', start: '/student/results', startLabel: 'Start as Student',
    value: 'Named attendance + reported grades show how SI relates to results — without spreadsheets.',
    steps: [
      'Student → SI & Results: Physics has finished. Evaluate the SI leader and report the final grade.',
      'Notifications: the weekly grade reminder disappears once the grade is reported.',
      'Switch to SI Supervisor → SI & Results: grades reported, correlation (Spearman ρ), pass rates by SI attendance, named student list.',
      'Export Excel report (summary, attendance groups, named students). SI leader evaluations tab shows anonymous ratings.',
      'Course end dates → “End now (demo)” on Mathematics 1 to start a new evaluation round. As SI Leader, the same page shows only anonymous statistics.',
    ],
  },
];

export function DemoGuide() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo Guide"
        description="Three recommended live scenarios. Each uses the same shared data — switch roles with the role switcher in the header to see the effect of every action."
        actions={<ResetButton />}
      />
      <AutomationNote>Tip: reset the demo data before a presentation so every scenario starts from the same, consistent state.</AutomationNote>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((s) => (
          <Card key={s.title} className="flex flex-col">
            <CardHeader className="flex-col">
              <span className="grid size-10 place-items-center rounded-lg bg-teal-50 text-teal-700"><s.icon className="size-5" /></span>
              <CardTitle className="mt-2">{s.title}</CardTitle>
              <CardDescription className="flex items-start gap-1.5"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-teal" />{s.value}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ol className="flex-1 space-y-2.5">
                {s.steps.map((st, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-700">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-navy-50 text-xs font-semibold text-navy">{i + 1}</span>
                    <span className="pt-0.5">{st}</span>
                  </li>
                ))}
              </ol>
              <Button className="mt-5 w-full" onClick={() => navigate(s.start)}>{s.startLabel}<ArrowRight /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>What is real and what is simulated?</CardTitle></CardHeader>
        <CardContent className="grid gap-6 text-sm text-slate-700 md:grid-cols-2">
          <div>
            <p className="mb-2 font-medium text-success">Working in this demo</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Shared, persistent data across all four roles (browser storage)</li>
              <li>Attendance, observations, EDU activities, surveys, topic requests and time preferences</li>
              <li>Automatic monthly report drafts, submission and supervisor approval</li>
              <li>Real file downloads: Excel, CSV, PDF and calendar (.ics)</li>
              <li>Excel/CSV import with preview and validation</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 font-medium text-warning">Simulated</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Login and role switching (no authentication)</li>
              <li>Notifications are in-app only — no email or SMS</li>
              <li>Survey invitations and “simulated responses”</li>
              <li>Primula export format is illustrative and not validated for import</li>
              <li>No connection to Ladok, TimeEdit, Canvas or other university systems</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
