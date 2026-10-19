import {
  LayoutDashboard, BookOpen, CalendarDays, MessageSquarePlus, Clock, Bell, ClipboardCheck, ListChecks, FileText, Users, Eye,
  GraduationCap, Award, ClipboardList, BarChart3, UserCog, FileCheck2, FileSpreadsheet, Wallet, type LucideIcon, UserRound, Presentation, Compass, ShieldCheck, Lightbulb,
} from 'lucide-react';
import type { Role } from '@/data/types';
import { PERSONAS } from '@/data/seed';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export interface RoleConfig { role: Role; label: string; personaId: string; icon: LucideIcon; blurb: string; nav: NavItem[] }

export const ROLES: Record<Role, RoleConfig> = {
  student: {
    role: 'student', label: 'Student', personaId: PERSONAS.student, icon: UserRound,
    blurb: 'See upcoming SI sessions, request topics and vote on preferred times.',
    nav: [
      { to: '/student', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/student/courses', label: 'My Courses', icon: BookOpen },
      { to: '/student/sessions', label: 'SI Sessions', icon: CalendarDays },
      { to: '/student/topics', label: 'Request Topics', icon: MessageSquarePlus },
      { to: '/student/times', label: 'Preferred Times', icon: Clock },
      { to: '/student/results', label: 'SI & Results', icon: Award },
      { to: '/student/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  leader: {
    role: 'leader', label: 'SI Leader', personaId: PERSONAS.leader, icon: Presentation,
    blurb: 'Register attendance once — reports and statistics update automatically.',
    nav: [
      { to: '/leader', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/leader/sessions', label: 'My Sessions', icon: CalendarDays },
      { to: '/leader/attendance', label: 'Attendance', icon: ClipboardCheck },
      { to: '/leader/requests', label: 'Student Requests', icon: ListChecks },
      { to: '/leader/reports', label: 'Monthly Reports', icon: FileText },
      { to: '/leader/results', label: 'SI & Results', icon: Award },
      { to: '/leader/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  coach: {
    role: 'coach', label: 'SI Coach', personaId: PERSONAS.coach, icon: Compass,
    blurb: 'Plan observations, EDU activities and surveys with systematic follow-up.',
    nav: [
      { to: '/coach', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/coach/leaders', label: 'My SI Leaders', icon: Users },
      { to: '/coach/observations', label: 'Observations', icon: Eye },
      { to: '/coach/edu', label: 'EDU1 & EDU2', icon: GraduationCap },
      { to: '/coach/surveys', label: 'Surveys', icon: ClipboardList },
      { to: '/coach/reports', label: 'Monthly Reports', icon: FileText },
      { to: '/coach/results', label: 'SI & Results', icon: Award },
      { to: '/coach/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  supervisor: {
    role: 'supervisor', label: 'SI Supervisor', personaId: PERSONAS.supervisor, icon: ShieldCheck,
    blurb: 'Monitor the whole SI programme and approve reports without spreadsheets.',
    nav: [
      { to: '/supervisor', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/supervisor/courses', label: 'Courses', icon: BookOpen },
      { to: '/supervisor/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/supervisor/results', label: 'SI & Results', icon: Award },
      { to: '/supervisor/team', label: 'Team Management', icon: UserCog },
      { to: '/supervisor/reports', label: 'Reports & Approvals', icon: FileCheck2 },
      { to: '/supervisor/import-export', label: 'Import & Export', icon: FileSpreadsheet },
      { to: '/supervisor/payroll', label: 'Payroll & Primula Export', icon: Wallet },
      { to: '/supervisor/feedback', label: 'Feedback inbox', icon: Lightbulb },
      { to: '/supervisor/notifications', label: 'Notifications', icon: Bell },
    ],
  },
};
export const ROLE_ORDER: Role[] = ['student', 'leader', 'coach', 'supervisor'];
