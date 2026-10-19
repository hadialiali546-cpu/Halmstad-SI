import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-muted-bg text-slate-600',
      navy: 'bg-navy-50 text-navy',
      teal: 'bg-teal-50 text-teal-700',
      success: 'bg-success-bg text-success',
      warning: 'bg-warning-bg text-warning',
      danger: 'bg-danger-bg text-danger',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export const Badge = ({ className, tone, ...p }: BadgeProps) => <span className={cn(badgeVariants({ tone }), className)} {...p} />;
