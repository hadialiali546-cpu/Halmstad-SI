// Built-in SI session plan templates. In production these could be shared by the SI programme.
import type { PlanActivity } from '@/data/types';

export interface PlanTemplate { id: string; name: string; description: string; goals: string; activities: Omit<PlanActivity, 'id'>[] }

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'problem-solving', name: 'Problem-solving workshop', description: 'Small groups solve problems, then share strategies.',
    goals: 'Students can choose and justify a method for typical problems on this topic.',
    activities: [
      { title: 'Warm-up question on the board', minutes: 10 },
      { title: 'Problems in groups of 3 (think–pair–share)', minutes: 50 },
      { title: 'Groups present one solution each', minutes: 25 },
      { title: 'Summary: key strategies and common mistakes', minutes: 15 },
      { title: 'Exit question / what to practise next', minutes: 5 },
    ],
  },
  {
    id: 'exam-prep', name: 'Exam preparation', description: 'Old exam questions under realistic conditions.',
    goals: 'Students practise exam-style questions and plan their revision.',
    activities: [
      { title: 'Revision priorities — students rank topics', minutes: 10 },
      { title: 'Timed exam question individually', minutes: 30 },
      { title: 'Peer marking with the grading criteria', minutes: 25 },
      { title: 'Group discussion of the hardest step', minutes: 25 },
      { title: 'Personal revision plan', minutes: 10 },
    ],
  },
  {
    id: 'concept-review', name: 'Concept review', description: 'Clarify a difficult concept from the lecture.',
    goals: 'Students can explain the concept in their own words and apply it to a simple example.',
    activities: [
      { title: 'Muddiest point from the lecture (sticky notes)', minutes: 10 },
      { title: 'Concept map in pairs', minutes: 25 },
      { title: 'Worked example — students lead each step', minutes: 30 },
      { title: 'Check questions in small groups', minutes: 25 },
      { title: 'Wrap-up: one sentence summary each', minutes: 10 },
    ],
  },
  {
    id: 'jigsaw', name: 'Jigsaw group work', description: 'Expert groups teach each other sub-topics.',
    goals: 'Each student becomes the expert on one sub-topic and teaches it to peers.',
    activities: [
      { title: 'Introduction and group allocation', minutes: 10 },
      { title: 'Expert groups study their sub-topic', minutes: 30 },
      { title: 'Home groups: each expert teaches', minutes: 40 },
      { title: 'Combined problem using all sub-topics', minutes: 15 },
      { title: 'Reflection round', minutes: 5 },
    ],
  },
];
