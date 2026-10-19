// Events that would be synced to a person's connected calendar, derived from live records.
import { format, parseISO, setHours } from 'date-fns';
import { attendanceMap, courseName, coursesOfStudent, sessionStatus, userName } from '@/data/calc';
import type { CalendarConnection, DB, Role } from '@/data/types';
import type { CalEvent } from './files';

export const ALL_TYPES: CalendarConnection['include'] = { sessions: true, edu: true, observations: true };

export function calendarEvents(db: DB, userId: string, role: Role, include: CalendarConnection['include'] = ALL_TYPES, now = new Date()): CalEvent[] {
  const att = attendanceMap(db);
  const out: CalEvent[] = [];
  const upcomingSession = (s: DB['sessions'][number]) => sessionStatus(s, att, now) === 'scheduled';

  if (include.sessions) {
    const list = role === 'student'
      ? db.sessions.filter((s) => coursesOfStudent(db, userId).includes(s.courseId))
      : role === 'leader' ? db.sessions.filter((s) => s.leaderId === userId) : [];
    list.filter(upcomingSession).forEach((s) => out.push({
      id: s.id, kind: 'session', start: s.start, durationMin: s.durationMin, location: s.location,
      title: `SI: ${courseName(db, s.courseId)}${role === 'leader' ? ' (you lead)' : ''}`,
      description: `Topic: ${s.topic}\nSI leader: ${userName(db, s.leaderId)}`,
    }));
  }
  if (include.edu && role !== 'student') {
    db.eduActivities
      .filter((e) => e.status === 'scheduled' && parseISO(e.start) > now && (role === 'coach' ? e.coachId === userId : e.participantIds.includes(userId)))
      .forEach((e) => out.push({ id: e.id, kind: 'edu', start: e.start, durationMin: e.durationMin, location: e.location, title: e.title, description: e.description }));
  }
  if (include.observations && role !== 'student') {
    db.observations
      .filter((o) => o.status !== 'completed' && o.date && (role === 'coach' ? o.coachId === userId : o.leaderId === userId))
      .forEach((o) => {
        // Use the leader's SI session on that day if there is one, otherwise 09:00
        const s = db.sessions.find((x) => x.leaderId === o.leaderId && !x.cancelled && format(parseISO(x.start), 'yyyy-MM-dd') === o.date);
        const start = s ? s.start : setHours(parseISO(o.date!), 9).toISOString();
        if (parseISO(start) < now) return;
        out.push({
          id: o.id, kind: 'observation', start, durationMin: s?.durationMin ?? 60, location: s?.location ?? 'To be confirmed',
          title: role === 'coach' ? `Observation ${o.number}: ${userName(db, o.leaderId)}` : `Observation ${o.number} by ${userName(db, o.coachId)}`,
          description: `SI observation (${courseName(db, o.courseId)})`,
        });
      });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
