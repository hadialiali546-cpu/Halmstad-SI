import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-xl border border-border bg-white shadow-card', className)} {...p} />
);
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-2 px-5 pt-5 pb-3', className)} {...p} />
);
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-[15px] font-semibold text-navy', className)} {...p} />
);
export const CardDescription = ({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted', className)} {...p} />
);
export const CardContent = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('px-5 pb-5', className)} {...p} />;
