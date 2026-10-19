import { useState } from 'react';
import { useStore } from '@/data/store';
import { coursesOfStudent, courseName, sessionStatus, userName } from '@/data/calc';
import { useAttendance, useMe } from '@/lib/hooks';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/form';
import { PageHeader, EmptyState, SessionStatusBadge } from '@/components/ui/misc';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { SessionCard } from '@/components/shared/SessionCard';
import { fmtDay, fmtTime } from '@/lib/utils';

export function StudentSessions() {
  const { db, now } = useStore();
  const { id } = useMe();
  const att = useAttendance();
  const courses = coursesOfStudent(db, id);
  const [course, setCourse] = useState('all');
  const list = db.sessions.filter((s) => courses.includes(s.courseId) && (course === 'all' || s.courseId === course));
  const upcoming = list.filter((s) => ['scheduled'].includes(sessionStatus(s, att, now)) || (s.cancelled && new Date(s.start) > now));
  const past = list.filter((s) => new Date(s.start) <= now).reverse();
  return (
    <div className="space-y-6">
      <PageHeader
        title="SI Sessions"
        description="All SI sessions for your courses. Download a session to your calendar with one click."
        actions={
          <Select aria-label="Filter by course" value={course} onChange={(e) => setCourse(e.target.value)} className="w-56">
            <option value="all">All my courses</option>
            {courses.map((c) => <option key={c} value={c}>{courseName(db, c)}</option>)}
          </Select>
        }
      />
      <section>
        <h2 className="mb-3 font-semibold text-navy">Upcoming</h2>
        {upcoming.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((s) => s.cancelled ? (
              <div key={s.id} className="rounded-xl border border-dashed border-danger/40 bg-danger-bg/40 p-4 text-sm">
                <p className="font-semibold text-navy">{courseName(db, s.courseId)}</p>
                <p className="text-muted">{fmtDay(s.start)}, {fmtTime(s.start)}</p>
                <div className="mt-2"><SessionStatusBadge status="cancelled" /></div>
              </div>
            ) : <SessionCard key={s.id} s={s} />)}
          </div>
        ) : <EmptyState title="No upcoming sessions" body="New sessions will appear here as soon as an SI leader schedules them." />}
      </section>
      <Card>
        <CardHeader><CardTitle>Past sessions</CardTitle></CardHeader>
        <Table>
          <THead><TR><TH>Date</TH><TH>Course</TH><TH>Topic</TH><TH className="hidden md:table-cell">SI leader</TH><TH>Status</TH><TH>You</TH></TR></THead>
          <TBody>
            {past.slice(0, 15).map((s) => (
              <TR key={s.id}>
                <TD className="whitespace-nowrap">{fmtDay(s.start)}, {fmtTime(s.start)}</TD>
                <TD>{courseName(db, s.courseId)}</TD>
                <TD>{s.topic}</TD>
                <TD className="hidden md:table-cell">{userName(db, s.leaderId)}</TD>
                <TD><SessionStatusBadge status={sessionStatus(s, att, now) === 'cancelled' ? 'cancelled' : sessionStatus(s, att, now) === 'scheduled' ? 'scheduled' : 'completed'} /></TD>
                <TD className="whitespace-nowrap text-sm">{att.get(s.id)?.studentIds?.includes(id) ? <span className="font-medium text-success">✓ Attended</span> : att.has(s.id) ? <span className="text-muted">—</span> : ''}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
