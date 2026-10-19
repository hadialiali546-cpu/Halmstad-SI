// Notifications = stored event notifications + reminders derived live from records.
// Derived reminders disappear automatically once the underlying task is done.
import { addDays, differenceInCalendarDays, format, isToday, isTomorrow, isYesterday, parseISO, startOfDay, subMonths } from 'date-fns';
import {
  feedbackDue, openCheckins, sessionEnd, studentsOfCourse, attendanceMap, coursesOfStudent, findReport, leadersOfCoach, monthKey, monthLabel, sessionStatus, userName, usersByRole,
} from './calc';
import type { AppNotification, DB, Role } from './types';

const sessionEndIso = (s: Parameters<typeof sessionEnd>[0]) => sessionEnd(s).toISOString();

export interface UINotification extends AppNotification {
  read: boolean;
  derived: boolean;
}

const dayWord = (d: Date) => (isToday(d) ? 'today' : isTomorrow(d) ? 'tomorrow' : isYesterday(d) ? 'yesterday' : format(d, 'EEEE d MMM'));

export function deriveReminders(db: DB, userId: string, role: Role, now: Date): AppNotification[] {
  const out: AppNotification[] = [];
  const att = attendanceMap(db);
  const today = startOfDay(now);
  const month = monthKey(now);
  const prevMonth = monthKey(subMonths(now, 1));

  if (role === 'student') {
    // End of course: SI evaluation + weekly grade reminders (until the student reports)
    db.courses.filter((c) => coursesOfStudent(db, userId).includes(c.id) && c.endDate && parseISO(c.endDate) < now).forEach((c) => {
      const attendedSI = db.attendance.some((a) => a.studentIds?.includes(userId) && db.sessions.find((s) => s.id === a.sessionId)?.courseId === c.id);
      if (attendedSI && !db.evaluations.some((e) => e.courseId === c.id && e.studentId === userId))
        out.push({
          id: `drv-stu-eval-${c.id}`, recipientIds: [userId], kind: 'info', link: '/student/results', createdAt: parseISO(c.endDate!).toISOString(),
          title: 'Evaluate your SI leader', body: `${c.name} has finished. Tell us about your SI leader — it takes 2 minutes.`,
        });
      if (!db.grades.some((g) => g.courseId === c.id && g.studentId === userId)) {
        const week = Math.floor(differenceInCalendarDays(now, parseISO(c.endDate!)) / 7);
        out.push({
          id: `drv-stu-grade-${c.id}-w${week}`, recipientIds: [userId], kind: 'warning', link: '/student/results',
          createdAt: addDays(parseISO(c.endDate!), week * 7).toISOString(),
          title: 'Weekly reminder: report your exam result',
          body: `Please report your final grade in ${c.name} (U, 3, 4 or 5) once you have it. It helps show how SI supports students.${week ? ` Reminder ${week + 1}.` : ''}`,
        });
      }
    });
    openCheckins(db, userId).filter((s) => !s.checkin!.studentIds.includes(userId)).forEach((s) => out.push({
      id: `drv-stu-checkin-${s.id}-${s.checkin!.code}`, recipientIds: [userId], kind: 'warning', link: '/student', createdAt: s.checkin!.openedAt,
      title: 'Check-in is open', body: `Check in to the ${db.courses.find((c) => c.id === s.courseId)?.name} SI session: scan the QR code or enter the code shown by your SI leader.`,
    }));
    feedbackDue(db, userId, now).slice(0, 2).forEach((s) => out.push({
      id: `drv-stu-fb-${s.id}`, recipientIds: [userId], kind: 'info', link: '/student', createdAt: sessionEndIso(s),
      title: 'How was your SI session?', body: `Rate the ${db.courses.find((c) => c.id === s.courseId)?.name} session on ${format(parseISO(s.start), 'EEE d MMM')} — it takes 10 seconds.`,
    }));
    const courses = coursesOfStudent(db, userId);
    const next = db.sessions
      .filter((s) => courses.includes(s.courseId) && sessionStatus(s, att, now) === 'scheduled' && parseISO(s.start) < addDays(today, 2))
      .slice(0, 3);
    next.forEach((s) => {
      const d = parseISO(s.start);
      out.push({
        id: `drv-stu-next-${s.id}`, recipientIds: [userId], kind: 'info', link: '/student/sessions', createdAt: today.toISOString(),
        title: 'Upcoming SI session',
        body: `Your ${db.courses.find((c) => c.id === s.courseId)?.name} SI session starts ${dayWord(d)} at ${format(d, 'HH:mm')} (${s.location}).`,
      });
    });
  }

  if (role === 'leader') {
    const mine = db.sessions.filter((s) => s.leaderId === userId);
    mine.forEach((s) => {
      const d = parseISO(s.start);
      const st = sessionStatus(s, att, now);
      if (st === 'scheduled' && (isToday(d) || isTomorrow(d)))
        out.push({
          id: `drv-ldr-today-${s.id}`, recipientIds: [userId], kind: 'info', link: '/leader/sessions', createdAt: today.toISOString(),
          title: 'Session reminder', body: `You have an SI session ${dayWord(d)} at ${format(d, 'HH:mm')} — ${s.location}.`,
        });
      if (st === 'attendance_pending')
        out.push({
          id: `drv-ldr-att-${s.id}`, recipientIds: [userId], kind: 'warning', link: `/leader/attendance?session=${s.id}`, createdAt: s.start,
          title: 'Attendance missing',
          body: `Attendance for ${isYesterday(d) ? "yesterday's" : isToday(d) ? "today's" : format(d, 'EEE d MMM') + "'s"} session is missing.`,
        });
    });
    const rep = findReport(db, userId, month);
    if (rep?.status === 'draft')
      out.push({
        id: `drv-ldr-rep-${rep.id}-draft`, recipientIds: [userId], kind: 'info', link: '/leader/reports', createdAt: rep.generatedAt,
        title: 'Report draft ready', body: `Your ${format(now, 'MMMM')} monthly report is ready for review.`,
      });
    if (!rep && mine.some((s) => monthKey(s.start) === month && att.has(s.id)))
      out.push({
        id: `drv-ldr-rep-${month}-gen`, recipientIds: [userId], kind: 'info', link: '/leader/reports', createdAt: today.toISOString(),
        title: 'Monthly report', body: `Your ${format(now, 'MMMM')} report can be generated from your recorded sessions.`,
      });
    db.reports.filter((r) => r.ownerId === userId && r.status === 'returned').forEach((r) =>
      out.push({
        id: `drv-ldr-ret-${r.id}`, recipientIds: [userId], kind: 'warning', link: '/leader/reports', createdAt: r.decidedAt ?? r.generatedAt,
        title: 'Correction requested', body: `Your ${monthLabel(r.month)} report was returned: ${r.supervisorComment ?? ''}`,
      }),
    );
    const courses = db.courseAssignments.filter((a) => a.leaderId === userId).map((a) => a.courseId);
    const open = db.topics.filter((t) => courses.includes(t.courseId) && t.status === 'open').length;
    if (open)
      out.push({
        id: `drv-ldr-topics-${open}`, recipientIds: [userId], kind: 'info', link: '/leader/requests', createdAt: today.toISOString(),
        title: 'Student topic requests', body: `${open} student topic request${open > 1 ? 's are' : ' is'} awaiting your decision.`,
      });
  }

  if (role === 'coach') {
    const leaders = leadersOfCoach(db, userId);
    db.observations
      .filter((o) => leaders.includes(o.leaderId) && o.status !== 'completed')
      .forEach((o) =>
        out.push({
          id: `drv-coa-obs-${o.id}-${o.status}`, recipientIds: [userId], kind: o.status === 'not_scheduled' ? 'warning' : 'info',
          link: '/coach/observations', createdAt: today.toISOString(),
          title: 'Observation outstanding',
          body: `${userName(db, o.leaderId)} still requires Observation ${o.number}${o.date ? ` (scheduled ${format(parseISO(o.date), 'd MMM')})` : ''}.`,
        }),
      );
    db.eduActivities
      .filter((e) => e.status === 'scheduled' && e.participantIds.some((p) => leaders.includes(p)))
      .forEach((e) => {
        const d = parseISO(e.start);
        const diff = differenceInCalendarDays(d, today);
        if (diff >= 0 && diff <= 7)
          out.push({
            id: `drv-coa-edu-${e.id}`, recipientIds: [userId], kind: 'info', link: '/coach/edu', createdAt: today.toISOString(),
            title: `${e.categoryId} upcoming`, body: `${e.categoryId} takes place on ${format(d, 'EEEE')} (${format(d, 'd MMM, HH:mm')}).`,
          });
      });
    const rep = findReport(db, userId, month);
    out.push({
      id: `drv-coa-rep-${month}-${rep?.status ?? 'none'}`, recipientIds: [userId], kind: 'info', link: '/coach/reports', createdAt: today.toISOString(),
      title: 'Monthly coaching report',
      body: rep ? `Your ${format(now, 'MMMM')} coaching report is ${rep.status === 'draft' ? 'ready for review' : rep.status}.` : `Your monthly coaching report is ready to be generated.`,
    });
  }

  if (role === 'supervisor') {
    const pending = db.reports.filter((r) => r.status === 'submitted').length;
    if (pending)
      out.push({
        id: `drv-sup-pending-${pending}`, recipientIds: [userId], kind: 'warning', link: '/supervisor/reports', createdAt: today.toISOString(),
        title: 'Reports awaiting approval', body: `${pending} monthly report${pending > 1 ? 's are' : ' is'} awaiting approval.`,
      });
    const missing = new Set(db.sessions.filter((s) => sessionStatus(s, att, now) === 'attendance_pending').map((s) => s.leaderId));
    if (missing.size)
      out.push({
        id: `drv-sup-missing-${missing.size}`, recipientIds: [userId], kind: 'warning', link: '/supervisor/team', createdAt: today.toISOString(),
        title: 'Missing attendance', body: `${missing.size} SI leader${missing.size > 1 ? 's have' : ' has'} missing attendance records.`,
      });
    db.courses.filter((c) => c.endDate && parseISO(c.endDate) < now).forEach((c) => {
      const missing = studentsOfCourse(db, c.id).filter((s) => !db.grades.some((g) => g.courseId === c.id && g.studentId === s)).length;
      if (missing)
        out.push({
          id: `drv-sup-grades-${c.id}-${missing}`, recipientIds: [userId], kind: 'info', link: '/supervisor/results', createdAt: today.toISOString(),
          title: 'Exam results outstanding', body: `${missing} student(s) in ${c.name} have not reported their result yet. Weekly reminders are sent automatically.`,
        });
    });
    const notSub = [...usersByRole(db, 'leader'), ...usersByRole(db, 'coach')].filter((u) => {
      const r = findReport(db, u.id, prevMonth);
      return !r || r.status === 'draft';
    });
    if (notSub.length)
      out.push({
        id: `drv-sup-notsub-${prevMonth}-${notSub.length}`, recipientIds: [userId], kind: 'info', link: '/supervisor/team', createdAt: today.toISOString(),
        title: 'Reports not submitted', body: `${notSub.length} ${monthLabel(prevMonth)} report(s) have not been submitted yet.`,
      });
  }
  return out;
}

export function notificationsFor(db: DB, userId: string, role: Role, now: Date): UINotification[] {
  const read = new Set(db.readNotificationIds);
  const stored = db.notifications.filter((n) => n.recipientIds.includes(userId)).map((n) => ({ ...n, read: read.has(n.id), derived: false }));
  const derived = deriveReminders(db, userId, role, now).map((n) => ({ ...n, read: read.has(n.id), derived: true }));
  return [...derived, ...stored].sort((a, b) => (a.read === b.read ? b.createdAt.localeCompare(a.createdAt) : a.read ? 1 : -1));
}
