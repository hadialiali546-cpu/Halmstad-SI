import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Table = ({ className, ...p }: HTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto"><table className={cn('w-full text-sm', className)} {...p} /></div>
);
export const THead = (p: HTMLAttributes<HTMLTableSectionElement>) => <thead className="border-b border-border bg-muted-bg/60" {...p} />;
export const TBody = (p: HTMLAttributes<HTMLTableSectionElement>) => <tbody className="divide-y divide-border" {...p} />;
export const TR = ({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) => <tr className={cn('hover:bg-muted-bg/40', className)} {...p} />;
export const TH = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap', className)} {...p} />
);
export const TD = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-4 py-3 align-middle text-slate-700', className)} {...p} />;
