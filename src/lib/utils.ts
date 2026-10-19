import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Consistent date formats across the app */
export const fmtDate = (d: string | Date) => format(typeof d === 'string' ? parseISO(d) : d, 'd MMM yyyy');
export const fmtDay = (d: string | Date) => format(typeof d === 'string' ? parseISO(d) : d, 'EEE d MMM');
export const fmtTime = (d: string | Date) => format(typeof d === 'string' ? parseISO(d) : d, 'HH:mm');
export const fmtDateTime = (d: string | Date) => format(typeof d === 'string' ? parseISO(d) : d, 'd MMM yyyy, HH:mm');
export const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
