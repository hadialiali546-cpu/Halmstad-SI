import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Workflow, BarChart3, Clock4 } from 'lucide-react';
import { ROLES, ROLE_ORDER } from '@/components/layout/roles';
import { Logo } from '@/components/layout/Logo';
import { ConceptBadge, LangSwitch, ResetButton } from '@/components/layout/AppShell';
import { useStore } from '@/data/store';
import { userName } from '@/data/calc';
import { useT } from '@/lib/i18n';

export function Landing() {
  const navigate = useNavigate();
  const { db } = useStore();
  const { t } = useT();
  return (
    <div className="min-h-screen bg-canvas">
      <div className="relative overflow-hidden bg-navy">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-teal/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 size-[300px] rounded-full bg-teal/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <Logo light />
            <div className="flex items-center gap-2">
              <ConceptBadge light />
              <LangSwitch />
              <ResetButton compact />
            </div>
          </div>
          <div className="mt-16 max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Halmstad SI</h1>
            <p className="mt-3 text-lg text-teal-200 sm:text-xl">{t('One Platform. Less Administration. More Learning.')}</p>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/70">
              A concept demo showing how students, SI leaders, SI coaches and supervisors in the Supplemental Instruction programme could share one coordinated platform — where a single recorded activity feeds reports, analytics and approvals automatically.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/guide" className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal px-4 text-sm font-medium text-white hover:bg-teal-700"><BookOpenCheck className="size-4" />{t('Demo Guide')}</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-auto -mt-16 max-w-6xl px-4 sm:px-6">
        <p className="mb-3 text-sm font-medium text-white/80">{t('Choose a role to explore the demo')}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_ORDER.map((r) => {
            const c = ROLES[r];
            return (
              <button
                key={r}
                onClick={() => navigate(`/${r}`)}
                className="group flex flex-col rounded-xl border border-border bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-navy-50 text-navy group-hover:bg-teal-50 group-hover:text-teal-700"><c.icon className="size-5" /></span>
                <span className="mt-4 text-base font-semibold text-navy">{t(c.label)}</span>
                <span className="text-sm text-muted">{userName(db, c.personaId)}</span>
                <span className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{c.blurb}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal">Open dashboard <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
              </button>
            );
          })}
        </div>

        <div className="mt-12 grid gap-6 pb-16 sm:grid-cols-3">
          {[
            { icon: Workflow, title: 'Record once, reuse everywhere', body: 'Attendance registered by an SI leader updates course statistics, monthly reports and the supervisor dashboard.' },
            { icon: Clock4, title: 'Less administration', body: 'Monthly reports are drafted automatically. Leaders and coaches only add their reflections.' },
            { icon: BarChart3, title: 'Transparent overview', body: 'Supervisors follow attendance, observations and approvals without consolidating spreadsheets.' },
          ].map((f) => (
            <div key={f.title} className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700"><f.icon className="size-[18px]" /></span>
              <div>
                <p className="text-sm font-semibold text-navy">{f.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="border-t border-border py-6 text-center text-xs text-muted">
          Concept demo with a fictional dataset. Inspired by the SI programme at Halmstad University; not an official or approved university system. Role switching is simulated — no real authentication.
        </p>
      </div>
    </div>
  );
}
