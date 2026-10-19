import { ResultsDueBanner } from '@/components/shared/ResultsDueBanner';
import { CheckinCard, FeedbackDueCard } from '@/components/shared/StudentSessionActions';
import { CalendarConnect } from '@/components/shared/CalendarConnect';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, BookOpen, Bell, MessageSquarePlus, ArrowRight, ThumbsUp } from 'lucide-react';
import { addDays } from 'date-fns';
import { useStore } from '@/data/store';
import { coursesOfStudent, courseName, sessionStatus } from '@/data/calc';
import { notificationsFor } from '@/data/notifications';
import { useAttendance, useMe } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, StatCard, EmptyState, TopicBadge } from '@/components/ui/misc';
import { SessionCard } from '@/components/shared/SessionCard';
import { cn } from '@/lib/utils';

export function StudentOverview() {
  const { db, now } = useStore();
  const { id, user, role } = useMe();
  const att = useAttendance();
  const navigate = useNavigate();
  const courses = coursesOfStudent(db, id);
  const upcoming = db.sessions.filter((s) => courses.includes(s.courseId) && sessionStatus(s, att, now) === 'scheduled');
  const next14 = upcoming.filter((s) => new Date(s.start) < addDays(now, 14));
  const notes = useMemo(() => notificationsFor(db, id, role, now), [db, id, role, now]);
  const myTopics = db.topics.filter((t) => courses.includes(t.courseId) && (t.studentId === id || t.voterIds.includes(id)));
  const prefs = db.timePrefs.filter((p) => p.studentId === id);

  return (
    <div className="space-y-6">
      <PageHeader title={`Hi ${user.name.split(' ')[0]} 👋`} description="Here is what is happening in the SI sessions for your courses." />
      <ResultsDueBanner />
      <CheckinCard />
      <FeedbackDueCard />
      <CalendarConnect variant="banner" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Sessions next 14 days" value={next14.length} onClick={() => navigate('/student/sessions')} />
        <StatCard icon={BookOpen} label="Courses with SI" value={courses.length} tone="teal" hint={`You attended ${db.attendance.filter((a) => a.studentIds?.includes(id)).length} sessions`} onClick={() => navigate('/student/courses')} />
        <StatCard icon={Bell} label="Unread notifications" value={notes.filter((n) => !n.read).length} tone="warning" onClick={() => navigate('/student/notifications')} />
        <StatCard icon={MessageSquarePlus} label="Topics requested / voted" value={myTopics.length} tone="success" onClick={() => navigate('/student/topics')} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-navy">Upcoming SI sessions</h2>
            <Link to="/student/sessions" className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline">All sessions <ArrowRight className="size-4" /></Link>
          </div>
          {upcoming.length ? (
            <div className="grid gap-4 md:grid-cols-2">{upcoming.slice(0, 4).map((s) => <SessionCard key={s.id} s={s} />)}</div>
          ) : <EmptyState title="No upcoming sessions" />}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Notifications</CardTitle><Link to="/student/notifications" className="text-sm font-medium text-teal hover:underline">View all</Link></CardHeader>
            <CardContent className="space-y-3">
              {notes.slice(0, 4).map((n) => (
                <div key={n.id} className="flex gap-2.5">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-slate-200' : 'bg-teal')} />
                  <p className="text-sm text-slate-700">{n.body}</p>
                </div>
              ))}
              {!notes.length ? <p className="text-sm text-muted">No notifications.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>My topic requests</CardTitle><Link to="/student/topics" className="text-sm font-medium text-teal hover:underline">Request</Link></CardHeader>
            <CardContent className="space-y-2.5">
              {myTopics.slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{t.text}</p>
                    <p className="text-xs text-muted">{courseName(db, t.courseId)} · <ThumbsUp className="inline size-3" /> {t.voterIds.length}</p>
                  </div>
                  <TopicBadge status={t.status} />
                </div>
              ))}
              {!myTopics.length ? <p className="text-sm text-muted">No requests yet.</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Preferred session times</CardTitle><Link to="/student/times" className="text-sm font-medium text-teal hover:underline">Edit</Link></CardHeader>
            <CardContent className="space-y-2">
              {prefs.length ? prefs.map((p) => (
                <div key={p.courseId} className="text-sm">
                  <p className="font-medium text-slate-800">{courseName(db, p.courseId)}</p>
                  <p className="text-muted">{p.slotIds.map((sid) => db.timeSlots.find((s) => s.id === sid)?.label).join(' · ')}</p>
                </div>
              )) : <p className="text-sm text-muted">You haven't shared any preferred times yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
