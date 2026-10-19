import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useStore } from '@/data/store';
import { coursesOfStudent } from '@/data/calc';
import { courseFinished } from '@/lib/results';
import { useMe } from '@/lib/hooks';
import { Button } from '@/components/ui/button';

/** Prompts a student whose course has finished to evaluate SI and report the final grade */
export function ResultsDueBanner() {
  const { db, now } = useStore();
  const { id } = useMe();
  const navigate = useNavigate();
  const due = coursesOfStudent(db, id).filter((c) => courseFinished(db, c, now)).map((c) => {
    const course = db.courses.find((x) => x.id === c)!;
    const grade = db.grades.some((g) => g.courseId === c && g.studentId === id);
    const attended = db.attendance.some((a) => a.studentIds?.includes(id) && db.sessions.find((s) => s.id === a.sessionId)?.courseId === c);
    const evaluated = !attended || db.evaluations.some((e) => e.courseId === c && e.studentId === id);
    return { course, todo: [!evaluated && 'evaluate your SI leader', !grade && 'report your final grade'].filter(Boolean) as string[] };
  }).filter((x) => x.todo.length);
  if (!due.length) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-bg/60 p-4 sm:flex-row sm:items-center">
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white text-warning"><GraduationCap className="size-6" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-navy">{due.map((d) => d.course.name).join(', ')} {due.length > 1 ? 'have' : 'has'} finished</p>
        <p className="text-sm text-slate-600">Please {Array.from(new Set(due.flatMap((d) => d.todo))).join(' and ')}. Weekly reminders continue until your grade is reported.</p>
      </div>
      <Button onClick={() => navigate('/student/results')}>Open SI &amp; Results</Button>
    </div>
  );
}
