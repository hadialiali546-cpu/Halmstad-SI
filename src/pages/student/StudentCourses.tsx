import { Link } from 'react-router-dom';
import { Users, CalendarDays, ArrowRight } from 'lucide-react';
import { useStore } from '@/data/store';
import { coursesOfStudent, courseById, leadersOfCourse, sessionStatus, userName } from '@/data/calc';
import { useAttendance, useMe } from '@/lib/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/misc';
import { fmtDay, fmtTime } from '@/lib/utils';

export function StudentCourses() {
  const { db, now } = useStore();
  const { id } = useMe();
  const att = useAttendance();
  const courses = coursesOfStudent(db, id).map((c) => courseById(db, c)!);
  return (
    <div>
      <PageHeader title="My Courses" description="Courses you are registered on that offer Supplemental Instruction (fictional enrolment data)." />
      <div className="grid gap-5 md:grid-cols-2">
        {courses.map((c) => {
          const sessions = db.sessions.filter((s) => s.courseId === c.id);
          const next = sessions.find((s) => sessionStatus(s, att, now) === 'scheduled');
          return (
            <Card key={c.id}>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-teal-700">{c.code} · {c.credits} credits</p>
                <p className="text-lg font-semibold text-navy">{c.name}</p>
                <p className="text-sm text-muted">{c.faculty}</p>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-start gap-2"><Users className="mt-0.5 size-4 text-muted" /><div><p className="text-xs text-muted">SI leaders</p><p className="font-medium text-slate-800">{leadersOfCourse(db, c.id).map((l) => userName(db, l)).join(', ')}</p></div></div>
                  <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 text-muted" /><div><p className="text-xs text-muted">Next session</p><p className="font-medium text-slate-800">{next ? `${fmtDay(next.start)}, ${fmtTime(next.start)}` : '—'}</p></div></div>
                </div>
                <div className="mt-4 flex gap-4 border-t border-border pt-3 text-sm">
                  <Link to="/student/sessions" className="inline-flex items-center gap-1 font-medium text-teal hover:underline">Sessions <ArrowRight className="size-4" /></Link>
                  <Link to="/student/topics" className="inline-flex items-center gap-1 font-medium text-teal hover:underline">Request a topic <ArrowRight className="size-4" /></Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
